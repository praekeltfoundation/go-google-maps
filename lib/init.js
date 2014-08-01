go.init = function() {
    var vumigo = require('vumigo_v02');
    var InteractionMachine = vumigo.InteractionMachine;
    var GoogleMaps = go.app.GoogleMaps;


    return {
        im: new InteractionMachine(api, new GoogleMaps())
    };
}();
