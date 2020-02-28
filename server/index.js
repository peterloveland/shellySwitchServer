global.__basedir = __dirname;

var mqtt = require('mqtt')
var config = require('../data/appConfig.json');
var rulesConfig = require('../data/motionRules.json');
var defaultRules = require('../data/rulesDefault.json');
const redis = require("redis");
const redisClient = redis.createClient();
var api = require('./api/api.js');

redisClient.on('ready',function() {
 console.log("Redis is ready");
});

redisClient.on('error',function() {
 console.log("Error in Redis");
});

var client  = mqtt.connect(config.mqttServer)

const allRooms = Object.keys(rulesConfig.rooms)

client.on('connect', function () {
  client.subscribe('zigbee2mqtt/#', function (err) {
    console.log(`Subscribing to all ${config.mqttBaseTopic} topics`)
  })
})

client.on('message', function (topic, message) {  
  // check which room the sensor is in
  let roomID = whichRoom(topic)
  // let roomLightsTimeout = 

  if ( isOccupancyInJSON(message) && roomID ) { // if motion is detected and it's not already running a script
    timeFrameCheck(roomID)
  }
})

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

function whichRoom(topic) {
  let activeRoom
  allRooms.forEach(roomID => { // loop through each room
    let roomSensors = rulesConfig.rooms[roomID].sensors // get list of topics for each sensor in the room
    roomSensors.forEach(sensorTopic => { // for each sensor
      if ( topic === sensorTopic ) { // if the sensor topic matches the topic
        activeRoom = roomID // then assign the activeRoom variable with the ID of the room
      }
    })
  });
  return activeRoom // and return it
}

function timeFrameCheck(roomID) {
  redisClient.get(roomID,function(err,lastTriggered){ // check to see if a timestamp already exists for the current room
    sendMessage(roomID,lastTriggered) // callback
  }); 
}

let roomTimersArray = []    

function sendMessage(roomID,lastTriggered) {

  const room = rulesConfig.rooms[roomID] // store room as var
  const timePeriods = room.timePeriods // get all the time periods associated with a room
  let currentTime = Date.now()
  const currentHour = new Date().getHours() // get the current time and store as an int

  timePeriods.forEach( timePeriod => { // for each time period for the room
    const start = timePeriod.start // store start
    const end   = timePeriod.end // store end

    ///////// COULD MAKE THE DEFAULTSWITCHOFFAFTRMINS VARIABLE. E.G. IF PAST 22:00 THEN BRIGHTNESS DEFAULT IS 10%. COULD
    ///////// COULD STILL MAKE THIS WORK ONLY WHEN THE TIME ENTRY IS IN THE MOTIONRULES.JSON CONFIG, BUT WITHOUT A BRIGHTNESS
    ///////// THIS MIGHT ALSO WORK FOR THE UI. E.G. WHEN SETTING UP A TIME YOU OPT INTO PROVIDING A BRIGHTNESS 

    let switchOffAfter = (timePeriod.switchOffAfterMins || config.defaultSwitchOffAfterMins) * 60000 // convert mins to ms, default is 5 minutes (if not specified in JSON)
    
    if ( currentHour >= start && currentHour < end ) { // if current time between the start/end
      let timeSinceLastTrigger = currentTime - lastTriggered
      if ( timeSinceLastTrigger < 0 ) { // basically means the zigbee chip won't be spammed. Will only send movement once every 120 seconds.
        console.log(`Motion detected in ${room.title} but no command is being sent`)
        redisClient.set(`${roomID}`, currentTime );
      } else {
        if ( timePeriod.trigger ) { // if the trigger is set
          room.lights.forEach(lightTopic => { // for each light 
            console.log(`${room.title} triggered. Lights coming up`)
            sendLightCommand(roomID,timePeriod,lightTopic,currentTime)
          })
        }
        if ( timePeriod.roomTrigger ) { // if the roomTrigger is set
          console.log(`Motion detected in ${roomID} but running motion against ${timePeriod.roomTrigger}`)
          timeFrameCheck(timePeriod.roomTrigger)
          return
        }
      }

      if( roomID in roomTimersArray ) {
        clearTimeout( roomTimersArray[roomID] )
      }
      roomTimersArray[roomID] = setTimeout( () => {
        turnLightsOff(roomID)
      } , switchOffAfter )

    }
  })
  
}

function turnLightsOff(roomID) {
  const room = rulesConfig.rooms[roomID] // store room as var
  room.lights.forEach(light => { // for each light 
    client.publish(`${config.mqttBaseTopic}/${light}/set`, `{"state":"ON","brightness":0}`) // set the brightness
  })
}

function sendLightCommand(roomID,timePeriod,lightTopic,currentTime) {
  let brightness
  if ( timePeriod.trigger.brightness ) { // if brightness has been set
    brightness = timePeriod.trigger.brightness // use this value
  } else { // if brightness hasn't been set
    brightness = checkDefaultBrightness()
  }
  client.publish(
    `${config.mqttBaseTopic}/${lightTopic}/set`, // topic
    `{"state":"ON","brightness":${ brightness  }}`, //message
    [],
    () => { 
      redisClient.set(`${roomID}`, currentTime ) // callback
    }
  ) 
}

function checkDefaultBrightness() {
  let brightness
  defaultRules.timePeriodDefaults.forEach( defaultTimePeriod => { // for each time period for the room
    const currentHour = new Date().getHours()
    const start = defaultTimePeriod.start // store start
    const end   = defaultTimePeriod.end // store end
    if ( currentHour >= start && currentHour < end ) { // if current time between the start/end
      brightness = defaultTimePeriod.brightness // store the default brightness as the brightness to be set
    }
  })
  return brightness || 100 // return the default brightness, unless it wasn't found (currentHour wasn't found between start/end) in which case return 100
}