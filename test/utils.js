var vumigo = require("vumigo_v01");
var Promise = vumigo.promise.Promise;
var success = vumigo.promise.success;


function GoogleMapsError(msg) {
    var self = this;
    self.msg = msg;

    self.toString = function() {
        return "<GoogleMapsError: " + self.msg + ">";
    };
}

function GoogleMapsApi(im, geocode_url) {
    var self = this;

    self.im = im;
    self.geocode_url = geocode_url;

    self.geolocate_get = function(address) {
        var p = new Promise();
        var url = self.geocode_url;
        url = url + '?' + self.url_encode({
            'address': address,
            'sensor': 'false'
        });
        self.im.api.request("http.get", {
                url: url,
                headers: self.headers
            },
            function(reply) {
                var json = self.check_reply(reply, url, 'GET', false);
                p.callback(json);
            });
        return p;
    };

    self.check_reply = function(reply, url, method, data, ignore_error) {
        var error;
        if (reply.success && reply.code == 200) {
            var json = JSON.parse(reply.body);
            return json;
        }
        else {
            error = reply.reason;
        }
        var error_msg = ("API " + method + " to " + url + " failed: " +
                         error);
        if (typeof data != 'undefined') {
            error_msg = error_msg + '; data: ' + JSON.stringify(data);
        }
        self.im.log(error_msg);
        if (!ignore_error) {
            throw new GoogleMapsError(error_msg);
        }
    };

    self.url_encode = function(params) {
        var items = [];
        for (var key in params) {
            items[items.length] = (encodeURIComponent(key) + '=' +
                                   encodeURIComponent(params[key]));
        }
        return items.join('&');
    };

    self.find_addresses = function(address) {
        var addresses = self.geolocate_get(address);
        addresses.add_callback(function(json) {
            return json.results.map(function(result) {
                var location = result.geometry.location;
                return {
                    id: (location.lat + "@" +
                            location.lng + "@" +
                            result.formatted_address),
                    text: result.formatted_address
                };
            });
        });
        return addresses;
    };
}

module.exports = {
    GoogleMapsApi: GoogleMapsApi
};