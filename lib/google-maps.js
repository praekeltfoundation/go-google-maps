go.app = function() {
    var vumigo = require('vumigo_v02');
    var LocationState = require('go-jsbox-location');
    var App = vumigo.App;
    var EndState = vumigo.states.EndState;
    var ChoiceState = vumigo.states.ChoiceState;
    var Choice = vumigo.states.Choice;
    var FreeText = vumigo.states.FreeText;

    var GoogleMaps = App.extend(function(self) {
        App.call(self, 'states:start_loc');

        self.states.add('states:start_loc', function(name) {
            return new LocationState(name, {
                question: "Where are you now?",
                next: 'states:end_loc',
                store_fields: ["geometry.location"],
                namespace: 'startlocation'
            });
        });

        self.states.add('states:end_loc', function(name) {
            return new LocationState(name, {
                question: "Where do you want to go?",
                next: 'states:send_dir',
                store_fields: ["geometry.location"],
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
        self.normalize_msisdn = function(number) {
            // Remove invalid characters
            number = number.replace(/( |[^0-9+])/g, '');
            // Handle ``00`` case
            number = number.replace(/^0{2}/, '+');
            var country_code = self.im.config.country_code;
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
                        content = self.normalize_msisdn(content);
                    }
                    // go to the end state if the input is valid
                    return content ? {
                        name: 'states:end',
                        creator_opts: {reply:content}
                        } : 'states:custom_to_addr';
                }
            });
        });

        self.states.add('states:end', function(name, opts) {
            return new EndState(name, {
                text: 'Directions sent!',
                next: 'states:start'
            });
        });

    });

    return {
        GoogleMaps: GoogleMaps
    };
}();
