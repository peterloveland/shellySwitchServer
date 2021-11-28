global.__basedir = __dirname;

var mqtt = require('mqtt')

global.config = require('../data/appConfig.json');

require('./registerWithHomebridge')
var EventEmitter = require('events');
const fs = require('fs');
const Sensor = require('node-hue-api/lib/model/sensors/Sensor');
var cron = require('node-cron');

var client = mqtt.connect(config.mqttServer)

client.on('connect', function () {
  client.subscribe(`${config.mqttBaseTopic}/+/#`, function () {
    console.log(`Subscribing to all ${config.mqttBaseTopic} topics`)
  })
  client.subscribe(`lights/hue/00:17:88:01:10:55:18:d4-0b/get/#`, function () {
    console.log(`Subscribing to all hue topic`)
  })
  client.subscribe(`homekitOverrides/+/set`, function () {
    console.log(`Subscribing to homekitOverrides topics`)
  })
  client.subscribe(`zigbee2mqtt/motion/+`, function () {
    console.log(`Subscribing to motionSensorTopics topics`)
  })
})

console.log("RUNNING")




client.on('message', function (topic, message) {

  let switchMatch = topic.match("shellies/[.*]/input/0")
  let i3match = topic.match("shellies/(.*)/input_event/(.*)")
  let homekitOverrideMatch = topic.match("homekitOverrides/(.*)/set")
  let motionSensorMatch = topic.match("zigbee2mqtt/motion/(.*)")

  // if switch sends a command
  if (switchMatch) {
    console.log(switchMatch[1])
    shouldSwitchTriggerAction("0", message)
  }

  if (i3match) {
    let switchID = i3match[1]
    let inputNumber = i3match[2]
    let event = JSON.parse(message.toString())
    updateshadowState(switchID, inputNumber, event)
  }

  if (homekitOverrideMatch) {
    receivedHomekitOverride(homekitOverrideMatch[1], message.toString(), Date.now())
  }

  if (motionSensorMatch) {
    motionSensorTrigger(motionSensorMatch[1], message.toString(), Date.now())
  }

})


const getShadowSwitchesIndex = (id) => {
  const objIndex = shadowSwitches.findIndex((theSwitch => theSwitch.id === id));
  return objIndex
}

const shouldSwitchTriggerAction = (id, payload) => {
  const objIndex = getShadowSwitchesIndex(id);
  let state = payload.toString()

  if (objIndex !== -1) { // if object already exists. Update it's state
    if (shadowSwitches[objIndex].state !== state) { // check if the state is the same
      shadowSwitches[objIndex].state = state // if it's not the same, update the state and trigger a toggle
      switchTrigger.emit("toggle", { id });
    }
  } else {
    switchTrigger.emit("toggle", { id }); // if it doesn't exist, trigger the toggle
    shadowSwitches.push({ // and add the new object to the array
      "id": id,
      "state": state
    })
  }

}

// set up event listener for when the switch state is changed (e.g. toggled)
const switchTrigger = new EventEmitter();
switchTrigger.on('toggle', (event) => switchStateChanged(event)); // Register for eventOne

function switchStateChanged(event) {
  toggleLight(event.id)
  //  console.log(`the switch ${event.id} was toggled`)
}

const toggleLight = (id) => {
  let lights = getLightsAssociatedToSwitch(id)
  lights.forEach((light) => {
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

  if (isLightOn) {
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
  return (255 * (percentage / 100)).toFixed(0)
}



const runOnStartup = () => {
  console.log("START UP")
  shadowRoomSync() // goes through the configured rooms and makes sure they're in the state, this should also copy across any existing state if room is already in the shadow state.
}


// I3 SCRIPTS



const updateshadowState = (switchID, inputNumber, payload) => {
  let shadowState = getShadowState()
  let room = whichRoomIsSwitchIn(switchID)
  let shadowRoom = shadowState.rooms.find(eachRoom => eachRoom.title === room)
  console.log("THIS:")
  console.log(shadowRoom)
  let allSwitchesInRoom = shadowRoom.switches
  let allInputsForSwitch = allSwitchesInRoom.find(eachSwitch => eachSwitch.title === switchID).inputs
  let theInput = allInputsForSwitch.find(input => input.inputNumber === inputNumber)
  if (theInput) {
    let theNewState = calculateSwitchState(switchID, inputNumber, theInput, payload)
    if (theNewState) {  // theNewState could return false if the event_count is duplicated
      theInput.state = theNewState.state
      theInput.previousCount = theNewState.updatedCount
      if (typeof theNewState.cachedState === "number") {
        theInput.cachedState = theNewState.cachedState
      }
      theInput.updated = theNewState.updated

      const resetRoomID = resetOverride(switchID)
      shadowState.rooms[resetRoomID].override = {}
      if (theNewState.state > 0) {
        resetTurnOffTimer(shadowRoom, room, 10)
      }
    }
  } else {
    // console.log(`dont' recognise this input ${inputNumber}. Needs to be registered in lightsRooms.json`)
  }
  fs.writeFileSync('./data/state/shadowState.json', JSON.stringify(shadowState, null, 2));
}

const getShadowState = () => {
  let shadowState = fs.readFileSync('./data/state/shadowState.json', { flag: "a+", encoding: 'utf8' })

  // console.log(typeof shadowState)
  if (!shadowState) {
    console.log('Shadow is empty. Makign it an object')
    // the rooms array doesn't exist. So make it
    shadowState = {}
    shadowState.rooms = []
    fs.writeFileSync('./data/state/shadowState.json', JSON.stringify(shadowState, null, 2), { flag: null });
    getShadowState() // rerun
  }

  return typeof shadowState === "object" ? shadowState : JSON.parse(shadowState) // parse into JSON so objects can be accessed
}

const shadowRoomSync = () => {
  let shadowState = getShadowState()


  let allRegisteredRooms = JSON.parse(fs.readFileSync('./data/config/lightsRooms.json', 'utf8')).rooms

  // console.log(allRegisteredRooms)

  allRegisteredRooms.forEach((room) => {
    let roomIndexInShadow = shadowState?.rooms?.findIndex((eachRoom) => eachRoom.title === room.title)
    console.log(roomIndexInShadow)
    if (roomIndexInShadow === -1) {
      shadowState.rooms.push({
        "title": room.title
      })
      fs.writeFileSync('./data/state/shadowState.json', JSON.stringify(shadowState, null, 2), { flag: 'w' });
      shadowRoomSync() // rerun
    } else {
      const roomObj = shadowState.rooms[roomIndexInShadow]
      roomObj.title = roomObj.title || room.title // this should never be needed but in here for good measure
      roomObj.override = roomObj.override || { type: null, timestamp: null } // if an override has already been set, use that, if not, use null
      roomObj.switches = getLightSwitches(room.title, roomObj)
      roomObj.motionSensors = getMotionSensors(room.title, roomObj)
      fs.writeFileSync('./data/state/shadowState.json', JSON.stringify(shadowState, null, 2), { flag: 'w' });
    }
  })
}

const getMotionSensors = (roomTitle, shadowRoomState) => {
  let roomMotionSensors = JSON.parse(fs.readFileSync('./data/config/lightsRooms.json', 'utf8')).rooms.find((room) => room.title === roomTitle).motionSensors
  let motionArray
  let existingMotionSensors = shadowRoomState.motionSensors


  if (existingMotionSensors === undefined) {
    motionArray = []
  } else {
    motionArray = existingMotionSensors
  }

  roomMotionSensors.forEach((eachSensor) => {
    let sensorIndex = motionArray.findIndex((eachExistingMotionSensor) => eachExistingMotionSensor.id === eachSensor.id)
    if (sensorIndex === -1) {
      // if motionArray can't find a switch with the same title... add it
      motionArray.push({
        "id": eachSensor.id,
        "lastTriggered": "timestamp"
      })
    }
  })
  // console.log(motionArray)
  return motionArray
}

const getLightSwitches = (roomTitle, shadowRoomState) => {
  let roomSwitches = JSON.parse(fs.readFileSync('./data/config/lightsRooms.json', 'utf8')).rooms.find((room) => room.title === roomTitle).switches
  let switchArray
  let existingSwitches = shadowRoomState.switches

  if (existingSwitches === undefined) {
    switchArray = []
  } else {
    switchArray = existingSwitches
  }

  roomSwitches.forEach((eachSwitch) => {
    let switchIndex = switchArray.findIndex((eachExistingSwitch) => eachExistingSwitch.title === eachSwitch.title)
    if (switchIndex === -1) {
      // if switchArray can't find a switch with the same title... add it
      switchArray.push({
        "title": eachSwitch.title,
        "inputs": getTriggers(eachSwitch.inputs, switchArray[switchIndex])
      })
    } else {
      switchArray[switchIndex].inputs = getTriggers(eachSwitch.inputs, switchArray[switchIndex])
    }
  })
  return switchArray
}

const getTriggers = (registeredTriggers, switchShadow) => {

  let shadowTrigger = switchShadow?.inputs ? switchShadow.inputs : []


  let triggerArray = []
  registeredTriggers.forEach((trigger) => {

    let existingShadowIndex = shadowTrigger.findIndex(shadowTrigger => shadowTrigger.inputNumber === trigger.inputNumber)
    let existingState = 0
    let existingCount = null
    let cachedState
    // let updated
    if (existingShadowIndex !== -1) {
      existingState = shadowTrigger[existingShadowIndex].state || 0 // if state is found, use that (if state isn't valid then use 0 as backup)
      existingCount = shadowTrigger[existingShadowIndex].previousCount || null // if previousCount is found, use that (if state isn't valid then use 0 as backup)
      cachedState = shadowTrigger[existingShadowIndex].cachedState || false
      // updated = shadowTrigger[existingShadowIndex].updated || null
    }
    triggerArray.push({
      "inputNumber": trigger.inputNumber,
      "state": existingState,
      "previousCount": existingCount
      // "updated": updated,
    })
    if (cachedState) { // probably a bit overkill for such an edge case but if the cached state already exists then may aswell push that too
      triggerArray[0].cachedState = cachedState
    }
  })
  return triggerArray
}



const calculateSwitchState = (switchID, inputNumber, existing, payload) => {
  let eventCount = payload.event_cnt
  if (existing.previousCount === payload.event_cnt) {
    return false // is repeated state. Don't update // INCLUDE IN PRODUCTION. REMOVE IN DEV
  }

  // console.log(payload.event_cnt - existing.previousCount)
  // // for some reason when the switch is held until the '' event it sends 2 a few seconds apart with an incremenet event_cnt
  // if ( payload.event === '' && (payload.event_cnt - existing.previousCount) === 1 ) {
  //   return false
  // } else {
  //   eventCount = payload.event_cnt - 1
  // }

  const shadowState = getShadowState()
  const room = whichRoomIsSwitchIn(switchID)
  const override = shadowState.rooms.find(eachRoom => eachRoom.title === room).override.type

  const oldState = existing.state
  const event = payload.event
  let stateTotal = getStateTotalCount(switchID, inputNumber)
  let newState

  switch (event) { // TOGGLE THE LIGHTS
    case "S":
      if (override === "on") {
        newState = 0
      } else if (override === "off") {
        newState = existing.state || 1
      } else {
        if (oldState === 0) {
          newState = existing.cachedState || 1
        } else {
          newState = 0
        }
      }
      break;
    case "L": // GO TO THE NEXT STATE
      console.log(override)
      if (override === "off") {
        newState = oldState
      } else {
        newState = oldState + 1 >= stateTotal ? 1 : oldState + 1
      }
      break;
    // case '':
    //   newState = 1
    //   break;
    case "autoTurnOff":
      console.log("auto turn off")
      newState = 0
      break;
    case "motionTurnOn":
      console.log("auto turn on")
      newState = existing.cachedState || 1
      break;
    default:
      newState = oldState
      break;
  }

  sendStateCommand(switchID, inputNumber, newState)
  return { "state": newState, "cachedState": oldState, "updatedCount": eventCount, "updated": Date.now() }
}

const resetOverride = (switchID) => {
  // console.log("RESET")
  const room = whichRoomIsSwitchIn(switchID)
  let shadowState = getShadowState()
  let allRooms = shadowState.rooms
  let theRoomIndex = allRooms.findIndex(eachRoom => eachRoom.title === room)
  return theRoomIndex
}

const getStateTotalCount = (switchID, inputNumber) => {
  const room = whichRoomIsSwitchIn(switchID)
  const allSwitches = JSON.parse(fs.readFileSync('./data/config/lightsRooms.json')).rooms.find(eachRoom => eachRoom.title === room).switches
  const allInputs = allSwitches.find(eachSwitch => eachSwitch.title === switchID).inputs
  const theStateTotal = allInputs.find(eachInput => eachInput.inputNumber === inputNumber).stateTotal || 1
  return theStateTotal
}

const whichRoomIsSwitchIn = (switchID) => {
  let allRooms = JSON.parse(fs.readFileSync('./data/config/lightsRooms.json'))

  // console.log(allRooms.rooms)

  // const index = allRooms.rooms.findIndex(x => x.title === "office");
  // console.log({ index })



  allRooms = Object.values(allRooms.rooms)
  console.log("all rooms:")
  console.log(allRooms.length)
  for (var i = 0; i < allRooms.length; i++) {
    console.log(`count ${i}`)
    let theRoomSwitches = allRooms[i].switches
    for (var i2 = 0; i2 < theRoomSwitches.length; i2++) {
      console.log("switch[i2].Title:")
      console.log(theRoomSwitches[i2].title)
      console.log("::")
      console.log(switchID)
      if (theRoomSwitches[i2].title === switchID) {
        console.log(`FOUND: ${allRooms[i].title}`)
        return allRooms[i].title
      } else {
        console.log(`no match`)
      }
    }
  }

}



const getSwitchesForRoom = (room) => {
  let allRooms = JSON.parse(fs.readFileSync('./data/config/lightsRooms.json')).rooms
  const allSwitchesForRoom = allRooms.find(eachRoom => eachRoom.title === room).switches
  return allSwitchesForRoom
}

const getInputsForSwitch = (allSwitches, switchID) => {
  let theInputs = allSwitches.find(eachSwitch => eachSwitch.title === switchID).inputs
  if (theInputs) {
    return theInputs
  } else
    console.log(`a switch with the id ${switchID} has not yet been registered. Add to lightsRooms.json`)
  return false
}

const sendStateCommand = (switchID, inputNumber, newState) => {
  // when the number of states is over 2 (+ the first state === 3) multiple homekit switches are needed. This divides up the payload to add a group which equates to one of those homekit switches
  const baseTopic = getSwitchTopic(switchID, inputNumber, newState)
  if (baseTopic) {
    let payload = calculatePayload(newState)
    let topic = `${baseTopic}/${payload.group}`
    console.log(`Sending "${payload.value}" value to: ${topic}`)
    client.publish(
      `${topic}`, `${payload.value}`
    )
  } else {
    console.error(`No topic found for ${switchID}:${inputNumber}`)
  }
}

const calculatePayload = (state) => {
  let group = Math.floor(+state / 3)
  let value = state - (group * 3)
  return { group, value }
}

const getSwitchTopic = (switchID, inputNumber, state) => {
  const room = whichRoomIsSwitchIn(switchID)
  const allSwitches = getSwitchesForRoom(room)
  const allInputs = getInputsForSwitch(allSwitches, switchID)
  const theTopic = allInputs.find(input => input.inputNumber === inputNumber).topic
  return theTopic
}

const receivedHomekitOverride = (id, message, timestamp) => {
  const override = whichRoomIsOverrideIn(id)
  const room = override.room
  const overrideType = override.overrideType
  const payload = message === 'true' ? true : false
  const mostRecentlyUpdatedTimestamp = getMostRecentTimestamp(room)
  const timeDiff = timestamp - mostRecentlyUpdatedTimestamp
  if (timeDiff > 1500) { // if most recent timestamp was less than x ms ago, assume this command was from the switch so is not an override
    setOverrideValue(room, overrideType, payload, timestamp)
  }

}

const getMostRecentTimestamp = (room) => {
  let shadowState = getShadowState()
  let allSwitchesInRoom = shadowState.rooms.find(eachRoom => eachRoom.title === room).switches
  let timestampArray = []
  allSwitchesInRoom.forEach((eachSwitch) => {
    eachSwitch.inputs.forEach((input) => {
      input.updated && timestampArray.push(input.updated)
    })
  })
  return Math.max(...timestampArray)
}

const whichRoomIsOverrideIn = (topicID) => {
  let allRooms = JSON.parse(fs.readFileSync('./data/config/lightsRooms.json')).rooms
  for (var i = 0; i < allRooms.length; i++) {
    let theRoom = allRooms[i]
    if (theRoom.homekitOverrideTopic.off === topicID) { return { "overrideType": "off", "room": theRoom.title } }
    if (theRoom.homekitOverrideTopic.on === topicID) { return { "overrideType": "on", "room": theRoom.title } }
  }
}

const setOverrideValue = (room, overrideType, payload, timestamp) => {
  let shadowState = getShadowState()
  let allRooms = shadowState.rooms
  if (allRooms) {
    let overrideObj = allRooms.find(eachRoom => eachRoom.title === room).override
    if (payload) { // payload is either true or false
      overrideObj.type = overrideType
      overrideObj.timestamp = timestamp
    }
  }
  writeToShadow(shadowState)
}

runOnStartup();

const writeToShadow = (content) => {
  // console.log(content)
  try {
    fs.writeFileSync('./data/state/shadowState.json', JSON.stringify(content, null, 2), { flag: 'w' });
    // console.log("Completed writing to staaate")
  } catch (e) {
    console.error(e);
  }
}




// TO DO MOTION SENSOR
// IDEA: IF SWITCH STATE IS NOT 0, IE THE SWITCH HAS BEEN TOGGLED,
// CHANGE MOTION SENSOR TIMEOUT TO BE MAYBE 15 MINS
// IF SWITCH STATE IS 0, MAYBE MAKE IT 5 MINS?

// MAYBE ANOTHER IDAE: IF THE LONG PRESS IS HELD... RESET THE MOTION SENSOR TIMER TO 2 HOURS
// ANOTHER IDEA IF STATE IS 4 (e.g. film?) DON'T LISTEN TO MOTION SENSOR EVER


const motionSensorTrigger = (motionID, message, timestamp) => {
  if (!JSON.parse(message).occupancy) { return false } // only run if occupancy is true
  let shadowState = getShadowState()
  let motion = updateMotionSensorShadow(shadowState, motionID, timestamp)
  if (!motion) { console.log(`motion sensor with id:${motionID} isn't registered to a room`); return false } // if motion sensor isn't registered

  console.log(`Detected motion in ${motion.room} on the sensor: ${motionID}`)
  let theRoomShadow = shadowState.rooms.find((room) => room.title === motion.room)
  let allSwitches = theRoomShadow.switches
  allSwitches.forEach((eachSwitch) => {
    eachSwitch.inputs.forEach((eachInput) => {
      let shouldTriggerStateChange = doesMotionAffectInput(motion.room, eachSwitch.title, eachInput.inputNumber)
      if (shouldTriggerStateChange) {
        let newState
        if (eachInput.state === 0 || theRoomShadow.override.type === "off") {
          newState = eachInput.cachedState || 1
          eachInput.state = newState
          eachInput.updated = timestamp // updates the timestamp so motion events don't count as overrides
          theRoomShadow.override = {}
          // sendStateCommand(eachSwitch.title, eachInput.inputNumber, newState)
          let payload = { "event": "motionTurnOn" }
          updateshadowState(eachSwitch.title, eachInput.inputNumber, payload)
        }
      }
    })
  })
  resetTurnOffTimer(theRoomShadow, motion.room)
  writeToShadow(shadowState)
}

const resetTurnOffTimer = (theRoomShadow, room, timeOverride) => {
  let minutes = 2 // start with a 2 minute timer
  if (timeOverride) { // if an override has been specified. Use that for the minutes
    minutes = timeOverride
  } else {
    let theRoomConfig = JSON.parse(fs.readFileSync('./data/config/lightsRooms.json')).rooms.find(eachRoom => eachRoom.title === room)
    if (theRoomConfig.motionTurnOffAfter) {  // if an override hasn't been specified, and a motionTurnOffAfter value has been set
      minutes = Math.min(theRoomConfig.motionTurnOffAfter, 2) // then use that (unless it's under 2 minutes in which case I override it to 2 mins)
    }
  }
  let countDown = minutes * 60000 // if minutes provided, makes sure it's more than 2 minutes. If no minutes provided default to 5
  const originalTime = theRoomShadow.turnOffAt
  const newTime = Date.now() + countDown
  theRoomShadow.turnOffAt = Math.max(originalTime, newTime) // if the old timer was bigger, don't update it
}

const doesMotionAffectInput = (room, theSwitch, input) => {
  console.log(room, theSwitch, input)
  let allRooms = JSON.parse(fs.readFileSync('./data/config/lightsRooms.json')).rooms
  let theRoom = allRooms.find(eachRoom => eachRoom.title === room)
  let allInputs = theRoom.switches.find(eachSwitch => eachSwitch.title === theSwitch).inputs
  let theInput = allInputs.find(eachInput => eachInput.inputNumber === input)
  if (theInput.isMotionSensorTrigger) {
    return theInput.isMotionSensorTrigger
  } else {
    return false
  }
}

const updateMotionSensorShadow = (shadowState, motionID, timestamp) => {
  let allRooms = shadowState.rooms
  let returnObj = false
  allRooms.forEach((room) => {
    let allMotionSensors = room.motionSensors
    allMotionSensors.forEach((motion) => {
      if (motion.id === motionID) {
        // let targetTriggers = getTargetTriggers(room.title,motionID)
        motion.lastTriggered = timestamp
        returnObj = { "room": room.title, "timestamp": timestamp }
      }
    })
  })
  return returnObj
}

const getTargetTriggers = (roomTitle, motionID) => {
  let allRooms = JSON.parse(fs.readFileSync('./data/config/lightsRooms.json')).rooms
  const theRoom = allRooms.find(eachRoom => eachRoom.title === roomTitle)
  const theMotionSensors = theRoom.motionSensors.find(motionSensor => motionSensor.id === motionID)
  return theMotionSensors.targetTrigger
}



cron.schedule("*/10 * * * * *", function () {
  checkToSwitchOff()
});

const checkToSwitchOff = () => {
  let shadowState = getShadowState()
  let allRooms = shadowState.rooms
  const timeNow = Date.now()

  if (!allRooms) {
    console.log("DON'T EXIST")
    console.log(shadowState.rooms)
    return false
  }

  allRooms.forEach((room) => {
    if (room.turnOffAt && timeNow > room.turnOffAt) {
      room.turnOffAt = null
      room.switches.forEach((eachSwitch) => {
        eachSwitch.inputs.forEach((eachInput) => {
          let payload = { "event": "autoTurnOff" }
          updateshadowState(eachSwitch.title, eachInput.inputNumber, payload)
        })
      })
    }
  })

  writeToShadow(shadowState)
}