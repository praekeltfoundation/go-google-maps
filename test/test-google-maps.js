var vumigo = require('vumigo_v02');
var fixtures = require('./fixtures/directions');
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
                                lng: '3.1415926535',
                                lat: '2.7182818284'
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
                                lat: '1.4142135623',
                                lng: '1.6180339887'
                            }
                        }
                    }],
                    status:"OK"
                }
            });

            locations.add_location({
                request:"a",
                response_data: {
                    results: 
                    [{
                        geometry: {
                            location:{
                                lat: '2',
                                lng: '3'
                            }
                        }
                    }],
                    status:"OK"
                }
            });

            locations.add_location({
                request:"b",
                response_data: {
                    results: 
                    [{
                        geometry: {
                            location:{
                                lat: '3',
                                lng: '2'
                            }
                        }
                    }],
                    status:"OK"
                }
            });

            locations.add_location({
                request:"c",
                response_data: {
                    results: 
                    [{
                        geometry: {
                            location:{
                                lat: '2',
                                lng: '2'
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
                    endpoint: 'sms',
                })
                .setup(function(api) {
                    fixtures().forEach(api.http.fixtures.add);
                    locations.fixtures.forEach(api.http.fixtures.add);
                })
                .setup.config.endpoint('sms', {
                    delivery_class: 'sms',
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
            beforeEach(function(){
                tester.input('Start Street');
            });
            it("should store the location in the contact store", function() {
                return tester
                    .check(function(api){
                        var contact = api.contacts.store[0];
                        assert.equal(contact.extra[
                            'startlocation:geometry:location:lng'],
                            '1.6180339887');
                        assert.equal(contact.extra[
                            'startlocation:geometry:location:lat'],
                            '1.4142135623');
                    })
                    .run();
            });

            it("should ask the user for an end location", function(){
                return tester
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
                            'endlocation:geometry:location:lng'],
                            '3.1415926535');
                        assert.equal(contact.extra[
                            'endlocation:geometry:location:lat'],
                            '2.7182818284');
                    })
                    .run();
            });
            it('should ask the user where they want to send', function() {
                tester.setup.user.state('states:end_loc');
                return tester
                        .input('Example Street')
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
            });
            describe('If the user enters a cell number', function() {
                beforeEach(function(){
                    tester.inputs('Start Street', 'Example Street', '2', 
                        '0741234567');
                });
                it('should respond that the message has been sent', function(){
                    return tester
                        .check.interaction({
                            state:'states:end',
                            reply: "Directions sent!"
                        })
                        .run();
                });
                it('should send the directions to the contact', function() {
                    return tester
                        .check(function(api){
                            var messages = api.outbound.store;
                            var message = messages[messages.length -2];
                            assert.deepEqual(message, {
                                to_addr: '+27741234567',
                                content: ['1. Head north on Av. Reconquista '+
                                    'towards Calle de la Diputación',
                                    '2. Head east'].join('\n'),
                                endpoint: 'sms'
                            });
                        })
                        .run();
                });
            });  
            describe('If the user selects themself', function(){
                beforeEach(function(){
                    tester.inputs('Start Street', 'Example Street', '1');
                });
                it('should respond that the message has been sent', function(){
                    return tester
                        .check.interaction({
                            state: 'states:end',
                            reply: 'Directions sent!'
                        })
                        .run();
                });
                it('should send the directions to the user', function() {
                    return tester
                        .check(function(api){
                            var messages = api.outbound.store;
                            var message = messages[messages.length -2];
                            assert.deepEqual(message, {
                                to_addr: '+27123456789',
                                content: ['1. Head north on Av. Reconquista '+
                                    'towards Calle de la Diputación',
                                    '2. Head east'].join('\n'),
                                endpoint: 'sms'
                            });
                        })
                        .run();
                });
            });
        });

        describe("When the user selects incorrect locations", function() {
            it("Should give an error message", function() {
                return tester
                    .inputs('a', 'b', '1')
                    .check.interaction({
                        state:'states:end',
                        reply: ['Error, cannot find directions for the given',
                            'locations.'].join(' ')
                    })
                    .run();
            });
        });

        describe("If Google Maps gives a strange response", function() {
            it("Should give an error message for no steps", function() {
                return tester
                    .inputs('b', 'a', '1')
                    .check.interaction({
                        state:'states:end',
                        reply: ['Error, cannot find directions for the given',
                            'locations.'].join(' ')
                    })
                    .run();
            });
            it("Should give an error message for no legs", function() {
                return tester
                    .inputs('c', 'b', '1')
                    .check.interaction({
                        state:'states:end',
                        reply: ['Error, cannot find directions for the given',
                            'locations.'].join(' ')
                    })
                    .run();
            });

            it("Should give an error message for no routes", function() {
                return tester
                    .inputs('b', 'c', '1')
                    .check.interaction({
                        state:'states:end',
                        reply: ['Error, cannot find directions for the given',
                            'locations.'].join(' ')
                    })
                    .run();
            });
        });

        describe("When the function ``normalize_msisdn`` is run", function() {
            it("Should remove invalid characters", function() {
                return tester
                    .check(function() {
                        assert.equal(app.normalize_msisdn('+12ab5 7','27'), 
                            '+1257');
                    })
                    .run();                
            });
            it("Should handle ``00`` case", function() {
                return tester
                    .check(function(){
                        assert.equal(app.normalize_msisdn('0027741234567','27'), 
                            '+27741234567');
                    })
                    .run();
            });
            it("Should handle the `0` case", function() {
                return tester
                    .check(function() {
                        assert.equal(app.normalize_msisdn('0741234567','27'), 
                            '+27741234567');
                    })
                    .run();
            });
            it("Should add the ``+`` in the case of country code", function() {
                return tester
                    .check(function() {
                        assert.equal(app.normalize_msisdn('27741234567','27'), 
                            '+27741234567');
                    })
                    .run();
            });
            it("should return null for incorrect numbers", function() {
                return tester
                    .check(function() {
                        assert.equal(app.normalize_msisdn('1234','27'), null);
                    })
                    .run();
            });
        });

        

    });
});
