var vumigo = require("vumigo_v01");
var jed = require("jed");

if (typeof api === "undefined") {
    // testing hook (supplies api when it is not passed in by the real sandbox)
    var api = this.api = new vumigo.dummy_api.DummyApi();
}

var Promise = vumigo.promise.Promise;
var success = vumigo.promise.success;
var Choice = vumigo.states.Choice;
var ChoiceState = vumigo.states.ChoiceState;
var FreeText = vumigo.states.FreeText;
var EndState = vumigo.states.EndState;
var InteractionMachine = vumigo.state_machine.InteractionMachine;
var StateCreator = vumigo.state_machine.StateCreator;

function GoogleMapsError(msg) {
    var self = this;
    self.msg = msg;

    self.toString = function() {
        return "<GoogleMapsError: " + self.msg + ">";
    };
}

function GoogleMapsApi(im) {
    var self = this;

    self.im = im;

    self.geolocate_get = function(address) {
        var p = new Promise();
        var url = "http://maps.googleapis.com/maps/api/geocode/json";
        url = url + '?' + self.url_encode({
            'address': address,
            'sensor': 'false'
        });
        self.im.api.request("http.get", {
                url: url,
                headers: self.headers
            },
            function(reply) {
                var json = self.check_reply(reply, url, 'GET', false);
                p.callback(json);
            });
        return p;
    };

    self.directions_get = function(origin, destination) {
        var p = new Promise();
        var url = 'http://maps.googleapis.com/maps/api/directions/json';
        url = url + '?' + self.url_encode({
            origin: origin,
            destination: destination,
            sensor: 'false'
        });
        self.im.api.request('http.get', {
                url: url,
                headers: self.headers
            },
            function(reply) {
                var json = self.check_reply(reply, url, 'GET', false);
                p.callback(json);
            });
        return p;
    };

    self.check_reply = function(reply, url, method, data, ignore_error) {
        var error;
        if (reply.success && reply.code == 200) {
            var json = JSON.parse(reply.body);
            return json;
        }
        else {
            error = reply.reason;
        }
        var error_msg = ("API " + method + " to " + url + " failed: " +
                         error);
        if (typeof data != 'undefined') {
            error_msg = error_msg + '; data: ' + JSON.stringify(data);
        }
        self.im.log(error_msg);
        if (!ignore_error) {
            throw new GoogleMapsError(error_msg);
        }
    };

    self.url_encode = function(params) {
        var items = [];
        for (var key in params) {
            items[items.length] = (encodeURIComponent(key) + '=' +
                                   encodeURIComponent(params[key]));
        }
        return items.join('&');
    };

    self.find_addresses = function(address) {
        var addresses = self.geolocate_get(address);
        addresses.add_callback(function(json) {
            return json.results.map(function(result) {
                var location = result.geometry.location;
                return {
                    id: (location.lat + "@" +
                            location.lng + "@" +
                            result.formatted_address),
                    text: result.formatted_address
                };
            });
        });
        return addresses;
    };

    self.get_directions = function(origin, destination) {
        var directions_json = self.directions_get(origin, destination);
        directions_json.add_callback(function(json) {
            var legs = json.routes[0].legs[0];
            return legs;
        });
        return directions_json;
    };
}

function GoogleMaps() {
    var self = this;
    StateCreator.call(self, 'start_address');

    self.maps_api = function(im) {
        return new GoogleMapsApi(im);
    };

    self.send_sms = function(im, content) {
        var sms_tag = im.config.sms_tag;
        if (!sms_tag) return success(true);
        var p = new Promise();
        im.api.request("outbound.send_to_tag", {
            to_addr: im.user_addr,
            content: content,
            tagpool: sms_tag[0],
            tag: sms_tag[1]
        }, function(reply) {
            p.callback(reply.success);
        });
        return p;
    };

    self.add_state(new FreeText(
        "start_address",
        "confirm_start_address",
        "Where are you now?"
    ));

    self.add_creator('confirm_start_address', function(state_name, im) {
        var maps_api = self.maps_api(im);
        var given_location = im.get_user_answer('start_address');
        var p = maps_api.find_addresses(given_location);
        p.add_callback(function(matches) {
            var choices = matches.map(function(m) {
                return new Choice(m.id, m.text);
            });
            choices[choices.length] = new Choice("try_again", "None of the above");
            return new ChoiceState(
                state_name,
                function(choice) {
                    return (choice.value == "try_again" ?
                            "start_address" :
                            "destination_address");
                },
                "Select a match:", choices);
        });
        return p;
    });

    self.add_state(new FreeText(
        "destination_address",
        "confirm_destination_address",
        "Where do you want to go?"
    ));

    self.add_creator('confirm_destination_address', function(state_name, im) {
        var maps_api = self.maps_api(im);
        var given_location = im.get_user_answer('destination_address');
        var p = maps_api.find_addresses(given_location);
        p.add_callback(function(matches) {
            var choices = matches.map(function(m) {
                return new Choice(m.id, m.text);
            });
            choices[choices.length] = new Choice("try_again", "None of the above");
            return new ChoiceState(
                state_name,
                function(choice) {
                    return (choice.value == "try_again" ?
                            "destination_address" :
                            "end");
                },
                "Select a match:", choices);
        });
        return p;
    });

    self.add_state(new EndState(
        "end",
        "Directions sent via SMS!",
        "start_address",
        {
            on_enter: function() {
                im = self.im;
                im.log('1');
                var maps_api = self.maps_api(im);
                var start_address = im.get_user_answer('confirm_start_address').split('@');
                im.log('start_address ' + start_address);
                var start_lat = start_address[0];
                var start_lng = start_address[1];
                var start_name = start_address[2];

                var dest_address = im.get_user_answer('confirm_destination_address').split('@');
                im.log('dest_address ' + dest_address);
                var dest_lat = dest_address[0];
                var dest_lng = dest_address[1];
                var dest_name = dest_address[2];

                var origin = start_lat + ',' + start_lng;
                var destination = dest_lat + ',' + dest_lng;

                im.log('origin ' + origin);
                im.log('destination ' + destination);

                var directions = maps_api.get_directions(origin, destination);
                im.log('directions ' + directions);
                directions.add_callback(function(directions) {
                    instructions = directions.steps.map(function(step, index) {
                        var html_instructions = step.html_instructions;
                        var stripped_instructions = html_instructions.replace(/<(?:.|\n)*?>/gm, '');
                        return index + 1 + '. ' + stripped_instructions;
                    }).join('\n');
                    im.log('instructions' + instructions);
                    return instructions;
                });
                directions.add_callback(function(instructions) {
                    return self.send_sms(im, instructions);
                });
                directions.add_callback(function(result) {
                    im.log('SMS instructions sent');
                });
                return directions;
            }
        }
    ));
}

// launch app
var states = new GoogleMaps();
var im = new InteractionMachine(api, states);
im.attach();