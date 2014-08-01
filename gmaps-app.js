// WARNING: This is a generated file.
//          If you edit it you will be sad.
//          Edit src/app.js instead.

var go = {};
go;

go.app = function() {
    var vumigo = require('vumigo_v02');
    var LocationState = require('go-jsbox-location');
    var App = vumigo.App;
    var EndState = vumigo.states.EndState;

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
                next: 'states:end',
                store_fields: ["geometry.location"],
                namespace: 'endlocation'
            });
        });

        self.states.add('states:end', function(name) {
            return new EndState(name, {
                text: 'Thanks, cheers!',
                next: 'states:start'
            });
        });
    });

    return {
        GoogleMaps: GoogleMaps
    };
}();

go.init = function() {
    var vumigo = require('vumigo_v02');
    var InteractionMachine = vumigo.InteractionMachine;
    var GoogleMaps = go.app.GoogleMaps;


    return {
        im: new InteractionMachine(api, new GoogleMaps())
    };
}();
