module.exports = function() {
  return [
  {
    "request": {
      "method": "GET",
      "url": "http://maps.googleapis.com/maps/api/directions/json",
      "params": {
        "origin":"3,2",
        "destination":"3,2",
        "sensor":"false"
      }
    },
    "response":{
      "code": 200,
      "data": [{
         "routes" : [],
         "status" : "ZERO_RESULTS"
      }]
    }
  },
  {
    "request": {
      "method": "GET",
      "url": "http://maps.googleapis.com/maps/api/directions/json",
      "params": {
        "origin":"1.6180339887,1.4142135623",
        "destination":"3.1415926535,2.7182818284",
        "sensor":"false"
      }
    },
    "response":{
      "code": 200,
      "data": [
        {
   "routes" : [
      {
         "bounds" : {
            "northeast" : {
               "lat" : 37.4229227,
               "lng" : -122.0854199
            },
            "southwest" : {
               "lat" : 37.4229227,
               "lng" : -122.0854199
            }
         },
         "copyrights" : "Map data ©2014 Google",
         "legs" : [
            {
               "distance" : {
                  "text" : "1 ft",
                  "value" : 0
               },
               "duration" : {
                  "text" : "1 min",
                  "value" : 0
               },
               "end_address" : "41-42 Amphitheatre Parkway, Mountain View, CA 94043, USA",
               "end_location" : {
                  "lat" : 37.4229227,
                  "lng" : -122.0854199
               },
               "start_address" : "41-42 Amphitheatre Parkway, Mountain View, CA 94043, USA",
               "start_location" : {
                  "lat" : 37.4229227,
                  "lng" : -122.0854199
               },
               "steps" : [
                  {
                     "distance" : {
                        "text" : "1 ft",
                        "value" : 0
                     },
                     "duration" : {
                        "text" : "1 min",
                        "value" : 0
                     },
                     "end_location" : {
                        "lat" : 37.4229227,
                        "lng" : -122.0854199
                     },
                     "html_instructions" : "Head \u003cb\u003eeast\u003c/b\u003e",
                     "polyline" : {
                        "points" : "gdlcFzxchV"
                     },
                     "start_location" : {
                        "lat" : 37.4229227,
                        "lng" : -122.0854199
                     },
                     "travel_mode" : "DRIVING"
                  }
               ],
               "via_waypoint" : []
            }
         ],
         "overview_polyline" : {
            "points" : "gdlcFzxchV"
         },
         "summary" : "",
         "warnings" : [],
         "waypoint_order" : []
      }
   ],
   "status" : "OK"
}
      ]
    }
  }];
};