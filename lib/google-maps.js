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

    self.add_state(new FreeText(
        "start_address",
        "confirm_address",
        "Where are you now?"
    ));

}

// launch app
var states = new GoogleMaps();
var im = new InteractionMachine(api, states);
im.attach();