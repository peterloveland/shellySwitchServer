global.__basedir = __dirname;

var mqtt = require('mqtt')
var config = require('./config.json');
var api = require('./api/api.js');

var client  = mqtt.connect(config.mqttServer)

const motion_bedroom_1 = `${config.mqttBaseTopic}/motionSensor1 a`
const light_bedroom_1 = `${config.mqttBaseTopic}/bedroomLights a`


client.on('connect', function () {
  client.subscribe('zigbee2mqtt/#', function (err) {
    console.log(`Subscribing to all ${config.mqttBaseTopic} topics`)
  })
})

let activeMotionSensors = []

client.on('message', function (topic, message) {  

    // need to update this function to be aware of time, e.g. store timestamp

    if ( isOccupancyInJSON(message) && !activeMotionSensors.includes(topic) ) { // if motion is detected and it's not already running a script
      // need to add function to update time, will need to store object of topic+lastObservedTimestamp in 'activeMotionSensors'
      activeMotionSensors.push(topic); // add the topic to the 'active' array
      client.publish(`${light_bedroom_1}/set`, '{"color":{"x":0.5,"y":0.5},"state":"ON","brightness":100}') // set the lights to 100%
      // setTimeout(()=> { // after 10 seconds
      //   client.publish(`${light_bedroom_1}/set`, '{"color":{"x":0.5,"y":0.5},"state":"ON","brightness":0}') // set the lights 0%
      //   activeMotionSensors.splice( activeMotionSensors.indexOf(topic), 1 ); // and remove the topic from the 'active' array
      // },10000)
    }
})

function isAlreadyActive(message) {
  //reset timer
}


// console.log(rules.rooms)

function isOccupancyInJSON(message) {
  try {
    let theMessage = JSON.parse(message.toString())
    if(theMessage.hasOwnProperty("occupancy")) {
      // return the value of 'occupancy' (probably true) 
      return theMessage.occupancy
    }
  }
  catch {
    // not JSON
    return false
  }
}





