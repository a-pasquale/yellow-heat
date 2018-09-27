# Yellow Heat vegetable oil burner monitoring system

More information about vegetable oil burner technology and installation for Yellow Heat burners is available at https://www.yellowheat.com/

## How it works
This monitoring system is designed to display current fuel level, record and display historical consumption of vegetable oil fuel, and display burner status. 

When the burner turns on or off, the device records the current fuel level. The monitoring device sends this data to the database. Cloud functions calculate fuel consumption when new data is posted in the database. The cross-platform app allows users to configure the monitoring device over bluetooth and displays current fuel level, total consumption, and historical usage. The cloud functions also provide notifications to the user and optionally to the fuel vendor when fuel level drops below a specificied point.

![Diagram](https://github.com/a-pasquale/yellow-heat/raw/master/docs/yellow-heat-diagram.png)

## Hardware

The Yellow Heat monitoring device is built on an [ESP32 microcontroller](http://esp32.net/). The ESP32 is a low-cost, low-power system on a chip (SoC) series with Wi-Fi & dual-mode Bluetooth capabilities. 

The device is powered with 110VAC converted to 12DC with a RECOM power supply (RAC02-12SGB). This is stepped down to 5V with  an LM2596 DC to DC Buck Converter to power the ESP32 board. The 12V also powers the fuel level sensor.

Fuel level is measured with a [Rochester 6860 magnetic liquid-level gauge](http://www.rochestergauges.com/products/8600.html). With an operating current of 7-8mA at VCC 12V, the guage returns an output of 0.5V - 4.5V. This is converted to a maximum of 3.3V using a voltage divider and indicates fuel level on pin 33.

Burner status (on/off) is measured using another LM2596 DC to DC Buck Converter which converts the 24V signal to 3.3V (HIGH) on pin 18.

![Schematic](https://github.com/a-pasquale/yellow-heat/raw/master/docs/yellow-heat-schematic.jpg)

## Firmware
The firmware is developed with [Mongoose OS](https://github.com/cesanta/mongoose-os),an IoT Firmware Development Framework with Over-The-Air firmware updates and remote management, built in flash encryption, a device management dashboard service, and the ability to code in C or JavaScript.
```bash
$ mos build --platform esp32
$ mos flash
```
The Mongoose OS dashboard for debugging is very helpful:
```bash
$ mos ui
```
