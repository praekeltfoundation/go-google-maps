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

function GoogleMaps() {
    var self = this;
    StateCreator.call(self, 'start_address');

    self.maps_api = function(im) {
        var cfg = im.config.google_maps_api;
        return new GoogleMapsApi(im, cfg.geocode_url);
    };


    self.add_state(new FreeText(
        "start_address",
        "confirm_start_address",
        "Where are you now?"
    ));

    self.add_creator('confirm_start_address', function(state_name, im) {
        var maps_api = self.maps_api(im);
        var given_location = im.get_user_data('start_address');
        var p = maps_api.find_addresses(given_location);
        p.add_callback(function(matches) {

        });
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