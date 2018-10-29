load('api_config.js');
load('api_http.js');
load('api_gpio.js');
load('api_timer.js');
load('api_math.js');
load('api_adc.js');
load("api_rpc.js");
load('api_arduino_onewire.js');
load('ds18b20.js');

let ledPin = 19;
let btnPin = Cfg.get('app.button');
let apiKey = Cfg.get('app.apiKey');
let url = 'https://yellow-heat.firebaseio.com/' + Cfg.get('user.uid') + '/' + Cfg.get('device.id');
let refresh_token = Cfg.get('user.refreshToken'); // Firebase refresh token
let token = '';          // Firebase id token
let refresh_time = 30; // minutes 
let temp_time = 5;     // minutes

let fuel = 33;      // pin for fuel guage
let full = 3935.0;  // value at full
let empty = 40.0;   // value at empty

let burn = 18;      // pin for burner
let burning = 0;    // burner status

// Initialize OneWire library
let ow = OneWire.create(21 /* pin */);
let n = 0;              // Number of sensors found on the OneWire bus
let rom = ['01234567']; // Sensors addresses
let tempF = 0;

let f = 0;              // Current fuel level
let t = 0;              // Current time

ADC.enable(fuel);
RPC.addHandler('readFuelLevel', function() {
  return ADC.read(33) / full;
});

RPC.addHandler('postToFirebase', function() {
  postFuelLevel();
}) 

GPIO.set_mode(burn, GPIO.MODE_INPUT);
GPIO.set_mode(ledPin, GPIO.MODE_OUTPUT); // LED warning if unable to post data
GPIO.write(ledPin, 1);

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

GPIO.set_button_handler(btnPin, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 200, function() {
    print("Button pushed");
    postFuelLevel();
}, null);

// Get a Firebase token
function getTokens() {
  HTTP.query({
    url: 'https://securetoken.googleapis.com/v1/token?key=' + apiKey,
    data: {
      'grant_type':	'refresh_token',
      'refresh_token': refresh_token
    },
    success: function(resp) {
      resp = JSON.parse(resp);
      token = resp.id_token;
      refresh_token = resp.refresh_token;
      print("tokens refreshed");
      print(resp.expires_in);
      print("expires in seconds");
      GPIO.write(ledPin, 1); // Turn on LED on successful post.
    },
    error: function(err) {
      print("error refreshing tokens");
      print(JSON.stringify(err));
      GPIO.blink(ledPin, 1000, 1000); // Blink warning LED.
    }
  });
}
getTokens();

// Refresh the tokens
Timer.set(refresh_time*60*1000 /* min x sec x ms */, Timer.REPEAT, function() {
  getTokens();
}, null);

function postFuelLevel() {
  f = ADC.read(fuel) / full;
  print("fuel:", f);
  t = Timer.now();
  print("Time:", t);
  
  HTTP.query({
    url: url + '/data.json?auth=' + token,
    data: {
      fuel: f,
      message: burning ? "on" : "off",
      timestamp: t
    },
    success: function(body, full_http_msg) {
      print("Posted successfully to Firebase: ", body);
      GPIO.write(ledPin, 1); // Turn on LED on successful post.
    },
    error: function(err) { 
      print("An error occurred when posting to Firebase: ", err);
      GPIO.blink(ledPin, 1000, 1000); // Blink warning LED.
    }
  });    
};

// Get temperature every minute
Timer.set(temp_time*60*1000 /* min x sec x ms */, Timer.REPEAT, function() {
  if ((n = searchSens()) === 0) {
    print('No device found');
  }

  for (let i = 0; i < n; i++) {
    let t = getTempF(ow, rom[i]);
    if (isNaN(t)) {
      print('No device found');
      break;
    } else {
      print('Sensor#', i, 'Temperature:', t, '*F');
      tempF = t;
    }
  }
  HTTP.query({
    url: url + '/temp.json?auth=' + token,
    data: {
      temp: tempF,
      timestamp: Timer.now()
    },
    success: function(body, full_http_msg) { 
      print("Temp posted to Firebase");
      GPIO.write(ledPin, 1); // Turn off warning LED on successful post. 
    },
    error: function(err) { 
      print(err); 
      GPIO.blink(ledPin, 1000, 1000); // Blink warning LED.
    },
  });
}, null);

RPC.addHandler('TempF', function() {
  return tempF;
});
