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
}

function GoogleMaps() {
    var self = this;
    StateCreator.call(self, 'start_address');

    self.maps_api = function(im) {
        return new GoogleMapsApi(im);
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
                            "report_location" :
                            "submit_report");
                },
                "Select a match:", choices);
        });
        return p;
    });

    self.add_state(new EndState(
        "end",
        "Thank you and bye bye!",
        "start_address"
    ));
}

// launch app
var states = new GoogleMaps();
var im = new InteractionMachine(api, states);
im.attach();