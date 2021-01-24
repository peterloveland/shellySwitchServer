global.__basedir = __dirname;

var mqtt = require('mqtt')
var config = require('../data/appConfig.json');
var rulesConfig = require('../data/motionRules.json');
var lightStates = require('../data/lightStates.json');
var defaultRules = require('../data/rulesDefault.json');
var api = require('./api/api.js');
var EventEmitter = require('events'); 
const { timeStamp } = require('console');


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
  client.subscribe(`${config.mqttBaseTopic}/+/#`, function (err) {
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

let shadowSwitchState = [
  { "name": "officeI3", "state": 0, "previousState": null, "previousCount": null }
]

client.on('message', function (topic, message) {
    
  // if hue sends an update. Update the shadow lights to match the light status. Allows us to determine the action when the switch is toggled
  if ( topic.match("lights/hue/.*/get/state" )) {
    setTimeout( () => {
      updateShadowLightState(`00:17:88:01:10:55:18:d4-0b`,message)
    },1000)
  }

  let switchMatch = topic.match("shellies/[.*]/input/0")
  let i3match = topic.match("shellies/(.*)/input_event/(.*)")

  // console.log(topic)

  // if switch sends a command
  if ( switchMatch ) {
    console.log(switchMatch[1])
    shouldSwitchTriggerAction("0",message)
  }

  if ( i3match ) {
    let switchID = i3match[1]
    let switchNumber = i3match[2]
    let event = JSON.parse(message.toString())
    setSwitchState(switchID, switchNumber, event)
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
    if ( !timeOfLastSwitch || Date.now() - timeOfLastSwitch > 5000 ) { // this means that the command didn't come from the switch
      shadowLights[objIndex].brightness = +brightness
      shadowLights[objIndex].on = state
      shadowLights[objIndex].overridden = true
      console.log(shadowLights)
    }
  } else {
    shadowLights.push({
      "id": id,
      "brightness": +brightness,
      "on": state,
      "overridden": false
    })
  }
  

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

let switchHasBeenTriggeredInTheLastSecond = false
let timeOfLastSwitch
// set up event listener for when the switch state is changed (e.g. toggled)
const switchTrigger = new EventEmitter();
switchTrigger.on('toggle', (event) => switchStateChanged(event) ); // Register for eventOne
switchTrigger.on('trigger', () => switchWasTriggered() ); // Register for eventOne

function switchStateChanged(event) {
    toggleLight(event.id)
  //  console.log(`the switch ${event.id} was toggled`)
}

function switchWasTriggered(event) {
  timeOfLastSwitch = Date.now()
  // console.log(timeOfLastSwitch)
  // switchHasBeenTriggeredInTheLastSecond = true
  // console.log({switchHasBeenTriggeredInTheLastSecond})
  // setTimeout( () => {
  //   switchHasBeenTriggeredInTheLastSecond = false
  //   console.log({switchHasBeenTriggeredInTheLastSecond})
  // },3000) // 3 seconds to allow the light to update the shadow without it being considered an override
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
  const isLightOn = shadowLights[objIndex].on

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
  return (255 * (percentage/100)).toFixed(0)
}

const convertToPercentage = (brightness) => {
  return ((+brightness / 255) * 100).toFixed(0)
}





// I3 SCRIPTS
const setSwitchState = (switchID, switchNumber, payload) => {

  const event = payload.event
  const eventCount = payload.event_cnt
  
  const theSwitchIndex = shadowSwitchState.findIndex((theSwitch => theSwitch.name === switchID));
  
  const currentState = shadowSwitchState[theSwitchIndex].state
  const previousState = shadowSwitchState[theSwitchIndex].previousState
  const previousCount = shadowSwitchState[theSwitchIndex].previousCount
  const theSwitchState = shadowSwitchState[theSwitchIndex]


  if ( +switchNumber === 0 && previousCount !== eventCount ) {
    
    // console.log(switchID, switchNumber, payload)


    if ( currentState !== 0 ) {
      theSwitchState.previousState = currentState
    }

    switch( event ) {
      case "S": // single press
        if ( currentState === 0) {
          theSwitchState.state = previousState ? previousState : 1
        } else {
          theSwitchState.state = 0
        }
        break;
      case "SS": // double press
        // go to the next state
        theSwitchState.state = cycleThroughState(switchID,currentState)
        break;
      case "SSS": // triple press
        break;
      case "L": // long press
        break;
      case "SL": // short press + long press
        break;
      default: 
        console.log(event)
    }

    theSwitchState.previousCount = eventCount

    let newState = shadowSwitchState[theSwitchIndex].state
    setLights(switchID,newState)

  }
  
}

const cycleThroughState = (switchID, currentState) => {
  const theSwitchIndex = lightStates.findIndex((theSwitch => theSwitch.name === switchID));
  const allStates = lightStates[theSwitchIndex].states
  const numberOfStates = allStates.length
  if ( currentState + 1 === numberOfStates ) { return 1 } else { return currentState + 1 } // at the top end of the states cycle back around to 1, OR just return the next state
}

const setLights = (switchID,newState) => {

  // to do WORK OUT IF ANY OF THE LIGHTS IN THE ROOM HAVE BEEN OVERRIDDEN. IF THEY HAVE AND ALL ARE OFF. GO TO THE NEXT STATE. IF THEY HAVEN'T GO TO THE NEXT STEATR
  const theSwitchIndex = lightStates.findIndex((theSwitch => theSwitch.name === switchID));
  const theLights = lightStates[theSwitchIndex].states.find( (state) => state.state === newState ).lights
  
  console.log(`setting to state: ${newState}`)

  switchTrigger.emit("trigger"); // this is to register that the switch is going to perform a change. So we know that this isn't an override by the home app/siri
  
  if ( newState === 0 ) {
    client.publish(
      `lights/hue/00:17:88:01:10:55:18:d4-0b/set/on`, `false`
    )
  } else {
    theLights.forEach( (light) => {    
      const brightness = convertTo255(light.brightness).toString()
      if ( brightness > 0 ) {
        client.publish(
          `lights/hue/00:17:88:01:10:55:18:d4-0b/set/on`, `true`
          )
          client.publish(
            `lights/hue/00:17:88:01:10:55:18:d4-0b/set/brightness`, brightness
            )
          } else {
            client.publish(
              `lights/hue/00:17:88:01:10:55:18:d4-0b/set/on`, `false`
              )
            }
            
      const shadowIndex = shadowLights.findIndex( light => light.id === "00:17:88:01:10:55:18:d4-0b")
      shadowLights[shadowIndex].overridden = false
      console.log(shadowLights)

    })
  }
}