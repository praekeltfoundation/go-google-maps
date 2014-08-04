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
                                longitude: '3.1415926535',
                                latitude: '2.7182818284'
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
                    name: 'googlemaps',
                    country_code: '27',
                    endpoint: 'sms'
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
                tester.setup.user.state('states:end_loc');
                return tester
                    .input("Example Street")
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
            it('should ask the user where they want to send', function() {
                tester.setup.user.state('states:send_dir');
                return tester
                       .check.interaction({
                        state: 'states:send_dir',
                        reply: [
                            'Where should the directions be sent?',
                            '1. Myself',
                            '2. Someone else'
                            ].join('\n')
                    })
                    .run();
            });
        });

        describe('When the user selects where to send', function() {
            describe('If the user selects another number', function() {
                it('should ask the user to specify a number', function() {
                    tester.setup.user.state('states:send_dir');
                    return tester
                        .input('2')
                        .check.interaction({
                            state: 'states:custom_to_addr',
                            reply: [
                                'Please specify the number to recieve the ',
                                'directions:'
                                ].join('')
                        })
                        .run();
                });  
                describe('If the user enters a cell number', function() {
                    it('should respond message has been sent', function(){
                        tester.setup.user.state('states:custom_to_addr');
                        return tester
                            .inputs('0741234567')
                            .check.interaction({
                                state:'states:end',
                                reply: "Directions sent!"
                            })
                            .run();
                    });
                });  
            });
            describe('If the user selects themself', function(){
                it('should respond that the message has been sent', function(){
                    tester.setup.user.state('states:send_dir');
                    return tester
                        .inputs(null, '1')
                        .check.interaction({
                            state: 'states:end',
                            reply: 'Directions sent!'
                        })
                        .run();
                });
            });
        });

        describe("When the function ``normalize_msisdn`` is run", function() {
            it("Should remove invalid characters", function() {
                return tester
                    .check(function() {
                        assert.equal(app.normalize_msisdn('+12ab5 7'), '+1257');
                    })
                    .run();                
            });
            it("Should handle ``00`` case", function() {
                return tester
                    .check(function(){
                        assert.equal(app.normalize_msisdn('0027741234567'), 
                            '+27741234567');
                    })
                    .run();
            });
            it("Should handle the `0` case", function() {
                return tester
                    .check(function() {
                        assert.equal(app.normalize_msisdn('0741234567'), 
                            '+27741234567');
                    })
                    .run();
            });
            it("Should handle the `0` case", function() {
                return tester
                    .check(function() {
                        assert.equal(app.normalize_msisdn('0741234567'), 
                            '+27741234567');
                    })
                    .run();
            });
            it("Should add the ``+`` in the case of country code", function() {
                return tester
                    .check(function() {
                        assert.equal(app.normalize_msisdn('27741234567'), 
                            '+27741234567');
                    })
                    .run();
            });
            it("should return null for incorrect numbers", function() {
                return tester
                    .check(function() {
                        assert.equal(app.normalize_msisdn('1234'), null);
                    })
                    .run();
            });
        });

        

    });
});
