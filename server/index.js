global.__basedir = __dirname;

var mqtt = require('mqtt')
var config = require('../data/appConfig.json');
var rulesConfig = require('../data/motionRules.json');
var lightStates = require('../data/lightStates.json');
var EventEmitter = require('events'); 

const fs = require('fs');
const e = require('cors');



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



client.on('connect', function () {
  client.subscribe(`${config.mqttBaseTopic}/+/#`, function () {
    console.log(`Subscribing to all ${config.mqttBaseTopic} topics`)
  })

  client.subscribe(`lights/hue/00:17:88:01:10:55:18:d4-0b/get/#`, function () {
    console.log(`Subscribing to all hue topic`)
  })
  
})


let shadowSwitchState = [
  { "name": "officeI3", "state": 0, "previousState": null, "previousCount": null }
]

client.on('message', function (topic, message) {
    
  // if hue sends an update. Update the shadow lights to match the light status. Allows us to determine the action when the switch is toggled
  if ( topic.match("lights/hue/.*/get/state" )) {
    setTimeout( () => {
      // updateShadowState('light',`00:17:88:01:10:55:18:d4-0b`,message)
    },1000)
  }

  let switchMatch = topic.match("shellies/[.*]/input/0")
  let i3match = topic.match("shellies/(.*)/input_event/(.*)")

  // if switch sends a command
  if ( switchMatch ) {
    console.log(switchMatch[1])
    shouldSwitchTriggerAction("0",message)
  }

  if ( i3match ) {
    // console.log("IS I3")
    let switchID = i3match[1]
    let switchNumber = i3match[2]
    let event = JSON.parse(message.toString())
    updateShadowSwitchState(switchID, switchNumber, event)
  }

})


const getShadowLightIndex = (id) => {
  let shadowState = getShadowState()
  // console.log(shadowState)
  // return objIndex
}

const getShadowSwitchesIndex = (id) => {
  const objIndex = shadowSwitches.findIndex((theSwitch => theSwitch.id === id));
  return objIndex
}


let shadowState

const getShadowState = () => {
  let shadowStateStore = fs.readFileSync('./data/state/shadowState.json')

  if(shadowStateStore) {
    try {
      shadowState = JSON.parse(shadowStateStore);
    } catch(e) {
      shadowState = {}
    }
  }

  return shadowState

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
switchTrigger.on('trigger', () => switchWasTriggered() ); // Register for eventOne

function switchStateChanged(event) {
    toggleLight(event.id)
  //  console.log(`the switch ${event.id} was toggled`)
}

function switchWasTriggered() {
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






// I3 SCRIPTS
const updateShadowSwitchState = (switchID, switchNumber, payload) => {
  let allStates = JSON.parse(fs.readFileSync('./data/state/shadowState.json'))
  let shadowSwitchState = allStates.shadowSwitchState
  let switchIndex = getSwitchID(shadowSwitchState,switchID)
  if ( switchIndex !== -1 ) {
    // console.log(`Switch exists at ${switchIndex}`)
    setSwitchNumberState(switchIndex, switchNumber, payload, switchID)
  } else {
    shadowSwitchState.push({
      id: switchID,
      switches: []
    })
    // console.log("Switch has been added")
    fs.writeFileSync('./data/state/shadowState.json', JSON.stringify(allStates,null,2));
    updateShadowSwitchState(switchID, switchNumber, payload) // rerun the function
  }
}

const setSwitchNumberState = (switchIndex, switchNumber, payload, switchID) => {
  let allStates = JSON.parse(fs.readFileSync('./data/state/shadowState.json'))
  let allSwitches = allStates.shadowSwitchState[switchIndex].switches
  theSwitch = getTheSwitches(allSwitches,switchNumber)
  if ( theSwitch === -1 ) {
    allSwitches.push({
      "id": switchNumber,
      "previousCount": null,
      "state": 0
    })
    fs.writeFileSync('./data/state/shadowState.json', JSON.stringify(allStates,null,2));
    setSwitchNumberState(switchIndex, switchNumber, payload, switchID)
  } else {
    let existingState = allSwitches[switchNumber].state
    console.log(`Existing State: ${existingState}`)
    theSwitch.previousCount = payload.event_cnt
    if ( payload.event === "S" && existingState !== 0 ) {
      theSwitch.cachedState = existingState
    } else if (payload.event === "SS") {
      delete theSwitch.cachedState
    }
    theSwitch.state = calculateSwitchState(switchID, allSwitches[switchNumber], switchNumber, payload, allSwitches[switchNumber].state)
    fs.writeFileSync('./data/state/shadowState.json', JSON.stringify(allStates,null,2));
  }
}

const calculateSwitchState = (switchID, theSwitch, switchNumber, payload, prev) => {
  const cachedState = prev
  const event = payload.event
  const room = whichRoomIsSwitchIn(switchID)
  let stateTotal
  try {
    stateTotal = JSON.parse(fs.readFileSync('./data/config/lightsRooms.json')).rooms.find( eachRoom => eachRoom.title === room ).switches.find( eachSwitch => eachSwitch.id === switchNumber).stateTotal
  } catch(e) {
    stateTotal = 1
  }
  if ( theSwitch.id === "0" ) { console.log({prev,theSwitch}) }

  
  switch ( event ) {
    case "S":
      return prev === 0 ? theSwitch.cachedState : 0
    case "SS":
      // console.log(cachedState + 1)
      return cachedState + 1 > stateTotal ? 1 : cachedState + 1
    default:
      break;
      
  }
}
  

const getSwitchID = (shadowSwitchState,switchID) => {
  let theID 
  try {
    theID = shadowSwitchState.findIndex( (theSwitch) => theSwitch.id === switchID )
  } catch(e) {
    console.error(e)
    return false
  }
  return theID
}

const getTheSwitches = (allSwitches,theSwitchNumber) => {
  if ( Object.keys(allSwitches).length !== 0 && allSwitches.constructor !== Object ) { 
    let theSwitch = allSwitches.find( theSwitch => theSwitch.id === theSwitchNumber)
    if ( theSwitch ) {
      return theSwitch
    }
  }
  return -1
  // console.log(theSwitch)
}

const whichRoomIsSwitchIn = (switchID) => {
  let allRooms = JSON.parse(fs.readFileSync('./data/config/lightsRooms.json'))
  allRooms = Object.values(allRooms.rooms)
  for (var i = 0; i < allRooms.length; i++) {
    let roomObj = allRooms[i]
    // console.log(roomObj)
    if ( roomObj.switch === switchID) {
      return roomObj.title
    }
    return false
  }
}


const cycleThroughState = (switchID, currentState) => {
  const theSwitchIndex = lightStates.findIndex((theSwitch => theSwitch.name === switchID));
  const allStates = lightStates[theSwitchIndex].states
  const numberOfStates = allStates.length
  if ( currentState + 1 === numberOfStates ) { return 1 } else { return currentState } // at the top end of the states cycle back around to 1, OR just return the next state
}

