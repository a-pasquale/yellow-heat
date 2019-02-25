load('api_config.js');
load('api_http.js');
load('api_gpio.js');
load('api_timer.js');
load('api_math.js');
load('api_adc.js');
load("api_rpc.js");
load('api_arduino_onewire.js');
load('ds18b20.js');
load('api_neopixel.js');

let ledPin = 19; // Not used
let btnPin = Cfg.get('app.button'); // Built-in button
let blePin = 4; // button to turn on BLE
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
let tempF = 0;          // Current temperature

// Neopixel status LED
let neoPin = 2, numPixels = 1, colorOrder = NeoPixel.GRB;
let strip = NeoPixel.create(neoPin, numPixels, colorOrder);

// Colors for status indicator
function warningLED() {
  strip.setPixel(0 /* pixel */, 84, 0, 0); // Red
  strip.show();
}
function happyLED() {
  strip.setPixel(0 /* pixel */, 0, 84, 13); // Green
  strip.show();
}
function configLED() {
  strip.setPixel(0 /* pixel */, 84, 0, 84); // Purple
  strip.show();
}
warningLED(); // Start with warning light

let f = 0;              // Current fuel level
let t = 0;              // Current time

ADC.enable(fuel);
RPC.addHandler('readFuelLevel', function() {
  return ADC.read(33) / full;
});

RPC.addHandler('postToFirebase', function() {
  postFuelLevel();
}) 

// Remove these later
GPIO.set_mode(ledPin, GPIO.MODE_OUTPUT); // LED warning if unable to post data
GPIO.write(ledPin, 1);

// Input for from the heater: 24VDC = on, 0 = off
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
      happyLED();
    },
    error: function(err) {
      print("error refreshing tokens");
      print(JSON.stringify(err));
      warningLED();
      GPIO.blink(ledPin, 1000, 1000); // Blink warning LED.
    }
  });
}

// Refresh the tokens
Timer.set(refresh_time*60*1000 /* min x sec x ms */, Timer.REPEAT, function() {
  if (!bt_enabled) { getTokens() };
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
      happyLED();
      return body
    },
    error: function(err) { 
      print("An error occurred when posting to Firebase: ", err);
      GPIO.blink(ledPin, 1000, 1000); // Blink warning LED.
      warningLED();
      return error
    }
  });    
};

function readTemp() {
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
}
// Get temperature 
Timer.set(temp_time*60*1000 /* min x sec x ms */, Timer.REPEAT, function() {
  readTemp();
  HTTP.query({
    url: url + '/temp.json?auth=' + token,
    data: {
      temp: tempF,
      timestamp: Timer.now()
    },
    success: function(body, full_http_msg) { 
      print("Temp posted to Firebase");
      GPIO.write(ledPin, 1); // Turn off warning LED on successful post.
      happyLED();
    },
    error: function(err) { 
      print(err); 
      GPIO.blink(ledPin, 1000, 1000); // Blink warning LED.
      warningLED();
    },
  });
}, null);

RPC.addHandler('TempF', function() {
  readTemp();
  return tempF;
});

// Device online?
Timer.set(60*1000 /* every minute */, Timer.REPEAT, function() {
  let url2 = 'https://yellow-heat.firebaseio.com/users/' + Cfg.get('user.uid') + '/' + Cfg.get('device.id') + '/.json';
  HTTP.query({
    headers: { 
      'X-HTTP-Method-Override': 'PATCH'
    },
    url:  url2 + '?auth=' + token,
    data: {
      lastSeen: Timer.now()
    },
    success: function(resp) {
      print(resp); 
      print("Timestamp posted to Firebase");
      GPIO.write(ledPin, 1); // Turn off warning LED on successful post.
      happyLED();
    },
    error: function(err) { 
      print(err); 
      GPIO.blink(ledPin, 1000, 1000); // Blink warning LED.
      warningLED();
    },
  });
}, null);

// Builtin button posts to Firebase
GPIO.set_button_handler(btnPin, GPIO.PULL_UP, GPIO.INT_EDGE_NEG, 200, function() {
  // print("Button pushed. Posting to Firebase...");
  // postFuelLevel();
  Cfg.set({bt: {enable: true}});
  Cfg.set({wifi: {sta: {enable: false}}});
  Sys.reboot(0);
}, null);

// Enable BT for configuration by pressing the button.
GPIO.set_button_handler(blePin, GPIO.PULL_DOWN, GPIO.INT_EDGE_POS, 50, function() {
  Cfg.set({bt: {enable: true}});
  Cfg.set({wifi: {sta: {enable: false}}});
  Sys.reboot(0);
}, null);

// Enable BT so device can be configured. 
// Once Wifi is working, BT will be disabled automatically.
let bt_enabled = Cfg.get('bt.enable');
if (bt_enabled) {
  configLED();
  // Turn off BT and reboot in 2 min
  Timer.set( 2 * 60 * 1000, false, function() {
    Cfg.set({wifi: {sta: {enable: true}}});
    Sys.reboot(0);
  }, null);
} else {
  warningLED();
};
// Refresh tokens when connected to the network.
Event.addHandler(Event.CLOUD_CONNECTED, function() {
  getTokens();
}, null);
// Set status
Event.addHandler(Event.REBOOT, function() {
  strip.clear();
}, null);
