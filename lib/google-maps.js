go.app = function() {
    var vumigo = require('vumigo_v02');
    var location = require('go-jsbox-location');
    var googlemaps = location.providers.googlemaps;
    var LocationState = location.LocationState;
    var App = vumigo.App;
    var EndState = vumigo.states.EndState;
    var ChoiceState = vumigo.states.ChoiceState;
    var Choice = vumigo.states.Choice;
    var FreeText = vumigo.states.FreeText;
    var JsonApi = vumigo.http.api.JsonApi;

    var GoogleMaps = App.extend(function(self) {
        App.call(self, 'states:start_loc');

        self.init = function() {
            self.http = new JsonApi(self.im);
        };

        self._extract_geometry = function(result) {
            return result.geometry.location;
        };

        self.states.add('states:start_loc', function(name) {
            return new LocationState(name, {
                question: "Where are you now?",
                next: 'states:end_loc',
                map_provider: new googlemaps.GoogleMaps({
                    extract_address_data: self._extract_geometry,
                }),
                namespace: 'startlocation'
            });
        });

        self.states.add('states:end_loc', function(name) {
            return new LocationState(name, {
                question: "Where do you want to go?",
                next: 'states:send_dir',
                map_provider: new googlemaps.GoogleMaps({
                    extract_address_data: self._extract_geometry,
                }),
                namespace: 'endlocation'
            });
        });

        self.states.add('states:send_dir', function(name) {
            return new ChoiceState(name, {
                question: 'Where should the directions be sent?',

                choices: [
                    new Choice('myself', 'Myself'),
                    new Choice('other', 'Someone else')
                    ],

                next: function(choice) {
                    return {
                        myself:'states:end',
                        other:'states:custom_to_addr'
                    }[choice.value];
                }
            });
        });

        // This function normalizes cellphone number inputs
        self.normalize_msisdn = function(number, country_code) {
            // Remove invalid characters
            number = number.replace(/[^0-9+]/g, '');
            // Handle ``00`` case
            number = number.replace(/^0{2}/, '+');
            if(country_code){
                // Handle ``0`` case
                number = number.replace(/^0/, ['+',country_code].join(''));
                // Add ``+``
                if(number.match('^' + country_code)) {
                    number = ['+',number].join('');
                }
            }           
            return (number.match(/^\+/)) ? number : null;
        };

        self.states.add('states:custom_to_addr', function(name) {
            return new FreeText(name, {
                question:'Please specify the number to recieve the directions:',
                next: function(content){
                    // normalize if the endpoint is cellphone
                    if(self.im.config.endpoint === 'sms') {
                        content = self.normalize_msisdn(content, 
                            self.im.config.country_code);
                    }
                    // go to the end state if the input is valid
                    return content !== null ? {
                        name: 'states:end',
                        creator_opts: {reply:content}
                        } : 'states:custom_to_addr';
                }
            });
        });

        self.directions_lookup = function() {
            var start, end, param;
            return self.im.contacts.for_user()
                .then(function(contact) {
                    start = {
                        lng:contact.extra
                            ['startlocation:lng'],
                        lat:contact.extra
                            ['startlocation:lat']
                    };
                    end = {
                        lng:contact.extra
                            ['endlocation:lng'],
                        lat:contact.extra
                            ['endlocation:lat']
                    };
                    param = {
                            origin:[start.lat,start.lng].join(','),
                            destination:[end.lat,end.lng].join(','),
                            sensor:'false'
                    };
                    return self.http.get(
                        'http://maps.googleapis.com/maps/api/directions/json', {
                        params:param})
                        .then(function(resp){
                            return resp.data;
                        });
                });            
        };

        self.process_directions = function(resp) {
            if(!resp.routes || !resp.routes[0] || !resp.routes[0].legs || 
                !resp.routes[0].legs[0] || !resp.routes[0].legs[0].steps
                || !resp.routes[0].legs[0].steps[0])
                return null;
            return resp.routes[0].legs[0].steps.map(function(step, index) {
                return [
                    (index+1), '. ',
                    step.html_instructions.replace(/<(?:.|\n)*?>/gm, '')
                    ].join('');
            }).join('\n');
        };

        self.send_message = function(addr, message) {
            if(addr) {
                return self.im.outbound.send({
                    to: addr,
                    endpoint: self.im.config.endpoint,
                    content: message
                });
            } else {
                return self.im.outbound.send_to_user({
                    endpoint: self.im.config.endpoint,
                    content: message
                });
            }
        };

        self.states.add('states:end', function(name, opts) {
            return self.directions_lookup()
                .then(function(resp) {
                    if(resp.status !== "OK") {
                        return null;
                    }
                    var directions = self.process_directions(resp);
                    return directions === null ?
                        null : self.send_message(opts.reply, directions);
                })
                .then(function(resp) {
                    return resp === null ? 
                        new EndState(name, {
                            text: ["Error, cannot find directions for the",
                                "given locations."].join(' '),
                            next: 'states:start'
                        })
                        : new EndState(name, {
                            text: 'Directions sent!',
                            next: 'states:start'
                        });    
                });
        });

    });

    return {
        GoogleMaps: GoogleMaps
    };
}();
