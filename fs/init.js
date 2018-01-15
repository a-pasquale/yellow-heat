load('api_config.js');
load('api_http.js');
load('api_gpio.js');
load('api_timer.js');
load('api_math.js');
load('api_adc.js');
load("api_rpc.js");

let button = Cfg.get('app.button');
let uid = Cfg.get('app.uid');
let heater = Cfg.get('device.id');

let fuel = 33;      // pin for fuel guage
let full = 3935.0;  // value at full
let empty = 40.0;   // value at empty

let burn = 18;      // pin for burner
let burning = 0;    // burner status

ADC.enable(fuel);

RPC.addHandler('Fuel', function() {
  return ADC.read(33) / full;
});


GPIO.set_mode(burn, GPIO.MODE_INPUT);

GPIO.set_int_handler(burn, GPIO.INT_EDGE_NEG, function(burn) {
  let calling = GPIO.read(burn);
  if (burning && !calling) {
    burning = 0;
    print('Turning off');
    postFuelLevel();
  } else if (!burning && calling) {
    burning = 1;
    print('Turning on');
    postFuelLevel();
  }
  print('Pin', burn, 'got interrupt');
}, null);
GPIO.enable_int(burn);

GPIO.set_button_handler(button, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 200, function() {
    print("Button pushed");
    postFuelLevel();
}, null);

function postFuelLevel() {
  HTTP.query({
        url: 'https://yellow-heat.firebaseio.com/data/' + heater + '.json',
        headers: { 
            //'X-HTTP-Method-Override': 'PUT'
        },
        data: {
            fuel: ADC.read(fuel) / full,
            message: burning ? "on" : "off",
            timestamp: Timer.now()
        },
        success: function(body, full_http_msg) { print(body); },
        error: function(err) { print(err); },
  });
}