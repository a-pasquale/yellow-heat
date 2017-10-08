load('api_config.js');
load("api_http.js");
load('api_gpio.js');
load("api_timer.js");

let button = Cfg.get('app.button');
let uid = Cfg.get('app.uid');
let heater = Cfg.get('app.heater');

GPIO.set_button_handler(button, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 200, function() {
    print("Button pushed");
    HTTP.query({
        url: 'https://yellow-heat.firebaseio.com/data/' . heater . '.json',
        headers: { },
        data: {
	    fuel: 1.0,
	    message: "on",
	    timestamp: Timer.now()
	},
        success: function(body, full_http_msg) { print(body); },
        error: function(err) { print(err); },
});
}, null);
