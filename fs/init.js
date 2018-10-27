load('api_config.js');
load('api_http.js');
load('api_gpio.js');
load('api_timer.js');
load('api_math.js');
load('api_adc.js');
load("api_rpc.js");

let button = Cfg.get('app.button');
let heater = Cfg.get('device.id');
let apiKey = Cfg.get('app.apiKey');
let uid = Cfg.get('user.uid');
let refresh_token = Cfg.get('user.refreshToken');

let fuel = 33;      // pin for fuel guage
let full = 3935.0;  // value at full
let empty = 40.0;   // value at empty

let burn = 18;      // pin for burner
let burning = 0;    // burner status

let f = 0;          // Current fuel level
let t = 0;          // Current time

ADC.enable(fuel);
RPC.addHandler('readFuelLevel', function() {
  return ADC.read(33) / full;
});

RPC.addHandler('postToFirebase', function() {
  postFuelLevel();
}) 

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
  f = ADC.read(fuel) / full;
  print("fuel:", f);
  t = Timer.now();
  print("Time:", t);
  
  // Get a new auth token from Firebase,
  // Then post to the database.
  HTTP.query({
    url: 'https://securetoken.googleapis.com/v1/token?key=' + apiKey,
    data: {
      'grant_type':	'refresh_token',
      'refresh_token': refresh_token
    },
    success: function(resp) {
      resp = JSON.parse(resp);
      refresh_token = resp.refresh_token;
      HTTP.query({
        url: 'https://yellow-heat.firebaseio.com/' + uid + "/" + heater + '/data.json?auth=' + resp.id_token,
        data: {
          fuel: f,
          message: burning ? "on" : "off",
          timestamp: t
        },
        success: function(body, full_http_msg) {
          print("Posted successfully to Firebase: ", body); 
        },
        error: function(err) { 
          print("An error occurred when posting to Firebase: ", err); 
        },
      });    
    },
    error: function(err) {
        print("Error getting new Firebase token", err)
    }
  })
  
}