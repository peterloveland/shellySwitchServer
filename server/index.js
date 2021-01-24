global.__basedir = __dirname;

var mqtt = require('mqtt')
var config = require('../data/appConfig.json');
var rulesConfig = require('../data/motionRules.json');
var defaultRules = require('../data/rulesDefault.json');
var api = require('./api/api.js');
var EventEmitter = require('events'); 


// let huejay = require('huejay');
// let hueClient = new huejay.Client(config.hue);


var client  = mqtt.connect(config.mqttServer)

// hueClient.bridge.ping()
//   .then(() => {
//     console.log('Successful connection to bridge');
//   })
//   .catch(error => {
//     console.log('Could not connect to bridge');
//   });



  // hueClient.lights.getAll()
  //   .then(lights => {
  //     for (let light of lights) {
  //       // let previous = this.lights[light.uniqueId];
  //       // this.lights[light.uniqueId] = light;
  //       console.log(light)
  //       // this.publishLight(previous, light);
  //     }
  //     // setTimeout(this.callback.bind(this), this.timeout);
  //   })
  //   .catch(error => {
  //     console.log(`An error occurred: ${error.message}`);
  //   });


const allRooms = Object.keys(rulesConfig.rooms)

client.on('connect', function () {
  client.subscribe(`${config.mqttBaseTopic}/+/input/0`, function (err) {
    console.log(`Subscribing to all ${config.mqttBaseTopic} topics`)
  })

  client.subscribe(`lights/hue/00:17:88:01:10:55:18:d4-0b/get/#`, function (err) {
    console.log(`Subscribing to all hue topic`)
  })
  
})

let shadowLights = []
let shadowSwitches = []

let switchConfigMap = [
  {
    switchID: 0,
    lights: [
      "00:17:88:01:10:55:18:d4-0b"
    ]
  }
]

client.on('message', function (topic, message) {
    
  // if hue sends an update. Update the shadow lights to match the light status. Allows us to determine the action when the switch is toggled
  if ( topic.match("lights/hue/.*/get/state" )) {
    updateShadowLightState(`00:17:88:01:10:55:18:d4-0b`,message)
  }

  // if switch sends a command
  if ( topic.match("shellies/.*/input/0" )) {
    shouldSwitchTriggerAction("0",message)
  }

})


const getShadowLightIndex = (id) => {
  const objIndex = shadowLights.findIndex((light => light.id === id));
  return objIndex
}

const getShadowSwitchesIndex = (id) => {
  const objIndex = shadowSwitches.findIndex((theSwitch => theSwitch.id === id));
  return objIndex
}


const updateShadowLightState = (id,payload) => {
  const objIndex = getShadowLightIndex(id)
  payload = JSON.parse(payload.toString())

  let brightness = convertToPercentage(payload.brightness)
  let state = brightness === 0 ? false : payload.state

  if ( objIndex !== -1 ) {
    shadowLights[objIndex].brightness = +brightness
    shadowLights[objIndex].state = state
  } else {
    shadowLights.push({
      "id": id,
      "brightness": +brightness,
      "state": state
    })
  }

  console.log(shadowLights)

}



const shouldSwitchTriggerAction = (id,payload) => {
  const objIndex = getShadowSwitchesIndex(id);
  let state = payload.toString()

  if ( objIndex !== -1 ) { // if object already exists. Update it's state
    if ( shadowSwitches[objIndex].state !== state ) { // check if the state is the same
      shadowSwitches[objIndex].state = state // if it's not the same, update the state and trigger a toggle
      switchTrigger.emit("toggle",{id});
    }
  } else {
    switchTrigger.emit("toggle",{id}); // if it doesn't exist, trigger the toggle
    shadowSwitches.push({ // and add the new object to the array
      "id": id,
      "state": state
    })
  }

}

// set up event listener for when the switch state is changed (e.g. toggled)
const switchTrigger = new EventEmitter();
switchTrigger.on('toggle', (event) => switchStateChanged(event) ); // Register for eventOne

function switchStateChanged(event) {
    toggleLight(event.id)
  //  console.log(`the switch ${event.id} was toggled`)
}



const toggleLight = (id) => {
  let lights = getLightsAssociatedToSwitch(id)
  lights.forEach( (light) => {
    getLightStatus(light)
  })
}

const getLightsAssociatedToSwitch = (id) => {
  const objIndex = switchConfigMap.findIndex((theSwitch => theSwitch.switchID === +id));
  const allLights = switchConfigMap[objIndex].lights
  return allLights
}

const getLightStatus = (id) => {
  const objIndex = getShadowLightIndex(id)
  const isLightOn = shadowLights[objIndex].state

  if ( isLightOn ) {
    // console.log("TURNING LIGHT OFF")
    client.publish(
      `lights/hue/00:17:88:01:10:55:18:d4-0b/set/on`, `false`
    ) 
  } else {
    // console.log("TURNING LIGHT ON")
    client.publish(
      `lights/hue/00:17:88:01:10:55:18:d4-0b/set/on`, `true`
    ) 
    client.publish(
      `lights/hue/00:17:88:01:10:55:18:d4-0b/set/brightness`, shadowLights[objIndex].brightness > 0 ? `${convertTo255(shadowLights[objIndex].brightness)}` : `${convertTo255(100)}`
    ) 
  }
}

const convertTo255 = (percentage) => {
  return 255 * (percentage/100)
}

const convertToPercentage = (brightness) => {
  return ((+brightness / 255) * 100).toFixed(0)
}