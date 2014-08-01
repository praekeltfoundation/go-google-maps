var vumigo = require('vumigo_v02');
var fixtures = require('./fixtures');
var AppTester = vumigo.AppTester;
var LocationState = require('go-jsbox-location');
var assert = require('assert');

describe("app", function() {
    describe("GoogleMaps", function() {
        var app;
        var tester;

        beforeEach(function() {
            app = new go.app.GoogleMaps();

            tester = new AppTester(app);

            locations = LocationState.testing();

            locations.add_location({
                request:"Example Street",
                response_data: {
                    results: 
                    [{
                        formatted_address:"Example Street, Suburb",
                        geometry: {
                            location:{
                                latitude: '3.1415926535',
                                longitude: '2.7182818284'
                            }
                        }
                    }, 
                    {
                        formatted_address:"Another Street, Suburb",
                        geometry: {
                            location: {
                                latitude: '2.7182818284',
                                longitude: '3.1415926535'
                            }
                        }
                    }],
                    status:"OK"
                }
            });

            locations.add_location({
                request:"Start Street",
                response_data: {
                    results: 
                    [{
                        formatted_address:"Start Street, Suburb",
                        geometry: {
                            location:{
                                latitude: '1.4142135623',
                                longitude: '1.6180339887'
                            }
                        }
                    }],
                    status:"OK"
                }
            });

            tester
                .setup.config.app({
                    name: 'googlemaps'
                })
                .setup(function(api) {
                    fixtures().forEach(api.http.fixtures.add);
                    locations.fixtures.forEach(api.http.fixtures.add);
                });
        });

        describe("when the user starts a session", function() {
            it("should ask where their location is", function() {
                return tester
                    .start()
                    .check.interaction({
                        state: 'states:start_loc',
                        reply: 'Where are you now?'
                    })
                    .run();
            });
        });

        describe("When the user enters their start location", function(){
            it("should store the location in the contact store", function() {
                return tester
                    .input('Start Street')
                    .check(function(api){
                        var contact = api.contacts.store[0];
                        assert.equal(contact.extra[
                            'startlocation:geometry:location:longitude'],
                            '1.6180339887');
                        assert.equal(contact.extra[
                            'startlocation:geometry:location:latitude'],
                            '1.4142135623');
                    })
                    .run();
            });
        });

        describe("When the user chooses the start location", function(){
            it("should ask the user for an end location", function(){
                return tester
                    .input('Start Street')
                    .check.interaction({
                        state: 'states:end_loc',
                        reply: "Where do you want to go?"
                    })
                    .run();
            });
        });

        describe("When the user chooses an end location", function(){
            it("should store the location in the contact", function() {
                return tester
                    .inputs('Start Street', "Example Street", "2")
                    .check(function(api) {
                        var contact = api.contacts.store[0];
                        assert.equal(contact.extra[
                            'endlocation:geometry:location:longitude'],
                            '3.1415926535');
                        assert.equal(contact.extra[
                            'endlocation:geometry:location:latitude'],
                            '2.7182818284');
                    })
                    .run();
            });
        });

    });
});
