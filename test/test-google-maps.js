var fs = require("fs");
var assert = require("assert");
var app = require("../lib/google-maps");


function fresh_api() {
    var api = app.api;
    api.reset();
    reset_im(api.im);
    return api;
}

function reset_im(im) {
    im.user = null;
    im.i18n = null;
    im.i18n_lang = null;
    im.current_state = null;
}

function maybe_call(f, that, args) {
    if (typeof f != "undefined" && f !== null) {
        f.apply(that, args);
    }
}

function check_state(user, content, next_state, expected_response, setup,
                     teardown) {
    // setup api
    var api = fresh_api();
    var from_addr = "1234567";
    var user_key = "users." + from_addr;
    api.kv_store[user_key] = user;

    maybe_call(setup, this, [api]);

    api.add_reply({
        cmd: "outbound.reply_to"
    });

    // send message
    api.on_inbound_message({
        cmd: "inbound-message",
        msg: {
            from_addr: from_addr,
            content: content,
            message_id: "123"
        }
    });

    // check result
    var saved_user = api.kv_store[user_key];
    assert.equal(saved_user.current_state, next_state);
    var reply = api.request_calls.shift();
    var response = reply.content;
    try {
        assert.ok(response);
        assert.ok(response.match(expected_response));
        assert.ok(response.length <= 163);
    } catch (e) {
        console.log(api.logs);
        console.log(response);
        console.log(expected_response);
        if (typeof response != 'undefined')
            console.log("Content length: " + response.length);
        throw e;
    }
    assert.deepEqual(app.api.request_calls, []);
    assert.equal(app.api.done_calls, 1);

    maybe_call(teardown, this, [api, saved_user]);
}

function check_close(user, next_state, setup, teardown) {
    var api = fresh_api();
    var from_addr = "1234567";
    var user_key = "users." + from_addr;
    api.kv_store[user_key] = user;

    maybe_call(setup, this, [api]);

    // send message
    api.on_inbound_message({
        cmd: "inbound-message",
        msg: {
            from_addr: from_addr,
            session_event: "close",
            content: "User Timeout",
            message_id: "123"
        }
    });

    // check result
    var saved_user = api.kv_store[user_key];
    assert.equal(saved_user.current_state, next_state);
    assert.deepEqual(app.api.request_calls, []);
    assert.equal(app.api.done_calls, 1);

    maybe_call(teardown, this, [api, saved_user]);
}


function CustomTester(custom_setup, custom_teardown) {
    var self = this;

    self._combine_setup = function(custom_setup, orig_setup) {
        var combined_setup = function (api) {
            maybe_call(custom_setup, self, [api]);
            maybe_call(orig_setup, this, [api]);
        };
        return combined_setup;
    };

    self._combine_teardown = function(custom_teardown, orig_teardown) {
        var combined_teardown = function (api, saved_user) {
            maybe_call(custom_teardown, self, [api, saved_user]);
            maybe_call(orig_teardown, this, [api, saved_user]);
        };
        return combined_teardown;
    };

    self.check_state = function(user, content, next_state, expected_response,
                                setup, teardown) {
        return check_state(user, content, next_state, expected_response,
                           self._combine_setup(custom_setup, setup),
                           self._combine_teardown(custom_teardown, teardown));
    };

    self.check_close = function(user, next_state, setup, teardown) {
        return check_close(user, next_state,
                           self._combine_setup(custom_setup, setup),
                           self._combine_teardown(custom_teardown, teardown));
    };
}

describe("test_api", function() {
    it("should exist", function() {
        assert.ok(app.api);
    });
    it("should have an on_inbound_message method", function() {
        assert.ok(app.api.on_inbound_message);
    });
    it("should have an on_inbound_event method", function() {
        assert.ok(app.api.on_inbound_event);
    });
});

describe("test_google_maps", function() {

    var fixtures = [
        'test/fixtures/geolocation.json',
        'test/fixtures/directions.json'
    ];

    var tester = new CustomTester(function (api) {
        api.config_store.config = JSON.stringify({
            sms_tag: ['pool', 'addr']
        });
        fixtures.forEach(function (f) {
            api.load_http_fixture(f);
        });
    });

    var assert_single_sms = function(content) {
        var teardown = function(api) {
            var sms = api.outbound_sends[0];
            assert.equal(api.outbound_sends.length, 1);
            assert.equal(sms.content, content);
        };
        return teardown;
    };

    it("should ask new users where they are", function () {
        tester.check_state(null, null, "start_address",
            "^Where are you now?");
    });

    it('should return a list of location matches', function() {
        tester.check_state({current_state: 'start_address'},
            '1600 Amphitheatre Parkway',
            'confirm_start_address',
            "^Select a match:[^]" +
            "1. 1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA[^]" +
            "2. None of the above$"
            );
    });

    it("should ask where they want to go to", function () {
        var user = {
            current_state: 'confirm_start_address',
            answers: {
                start_address: '1600 Amphitheatre Parkway'
            }
        };
        tester.check_state(user,
            '1',
            "destination_address",
            "^Where do you want to go?");
    });

    it('should ask a destination_address when given a confirm_start_address', function() {
        tester.check_state({current_state: 'destination_address'},
            '1600 Amphitheatre Parkway',
            'confirm_destination_address',
            "^Select a match:[^]" +
            "1. 1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA[^]" +
            "2. None of the above$"
            );
    });

    it('should ask do a directions lookup and send an SMS at the end.', function() {
        var user = {
            current_state: 'confirm_destination_address',
            answers: {
                start_address: '1600 Amphitheatre Parkway',
                confirm_start_address: '37.4229181@-122.0854212@1600 Amphitheatre Parkway',
                destination_address: '1600 Amphitheatre Parkway'
            }
        };

        var expected_sms = [
            '1. Head north on Bay St toward Hagerman St',
            '2. Turn right onto Dundas St W',
            '3. Turn left onto the Don Valley Parkway ramp',
            '4. Merge onto Don Valley Pkwy N',
            '5. Take the ON-401 E exit',
            '6. Merge onto Ontario 401 Express',
            '7. Merge onto ON-401 E',
            '8. Continue onto Autoroute du Souvenir/Autoroute 20 EEntering QC',
            '9. Continue onto Autoroute 720 E',
            '10. Take exit 6 toward Rue Berri',
            '11. Merge onto Rue Saint Antoine E',
            '12. Turn right onto Rue Bonsecours',
            '13. Turn right onto Rue Notre-Dame EDestination will be on the right'
        ].join('\n');

        tester.check_state(user,
            '1',
            'send_directions',
            '^Directions sent via SMS![^]' +
            '1. Get more directions[^]' +
            '2. End session$',
            null,
            assert_single_sms(expected_sms));
    });
});
