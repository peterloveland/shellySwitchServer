const fs = require('fs');

if (process.env.NODE_ENV === "development") {
  global.homebridgeConfigPath = "/Volumes/pi's home/.homebridge/config.json"
} else {
  global.homebridgeConfigPath = "/home/pi/.homebridge/config.json"
}

let homebridgeConfig = JSON.parse(fs.readFileSync(homebridgeConfigPath));

let rooms = JSON.parse(fs.readFileSync('./data/config/lightsRooms.json', 'utf8')).rooms

const peterPrefix = "__" // should help uniquely identify any switches

const registeredAccessories = homebridgeConfig.accessories


let clearedAccessories = registeredAccessories.filter((accessory) => {
  return accessory.name.substring(0, 2) !== peterPrefix // remove all accessories added by this app
})

rooms.map((room) => {

  const roomIsOffConfig = {
    "type": `switch`,
    "name": `${peterPrefix}${room.title}IsOff`,
    "topics": {
      "getOn": `homekitOverrides/${room.title}IsOff/get`,
      "setOn": `homekitOverrides/${room.title}IsOff/set`
    },
    "accessory": "mqttthing"
  }

  clearedAccessories.push(roomIsOffConfig)

  const roomIsOnConfig = {
    "type": `switch`,
    "name": `${peterPrefix}${room.title}IsOn`,
    "topics": {
      "getOn": `homekitOverrides/${room.title}IsOn/get`,
      "setOn": `homekitOverrides/${room.title}IsOn/set`
    },
    "accessory": "mqttthing"
  }

  clearedAccessories.push(roomIsOnConfig)

  room.switches.map((theSwitch) => {
    let switchTitle = theSwitch.title
    theSwitch.inputs.map((theInput) => {
      let totalNumberOfScenes = theInput.stateTotal
      // console.log(totalNumberOfScenes)
      // create the total number of switches (each switch can hold 3 actions)

      let switchConfigs = []
      for (let i = 0; i < Math.ceil(totalNumberOfScenes / 3); i++) {
        switchConfigs.push({
          "type": "statelessProgrammableSwitch",
          "name": `${peterPrefix}${switchTitle}_${i}`,
          "topics": {
            "getSwitch": `peterSwitch/${switchTitle}/0/${i}`
          },
          "switchValues": [],
          "accessory": "mqttthing"
        })
      }

      console.log(switchConfigs)

      // create the slots for the actions, can be up to 3 (0,1,2)
      for (let i = 0; i < totalNumberOfScenes; i++) {
        let section = Math.floor(i / 3)
        let value = i % 3
        console.log(value)
        switchConfigs[section].switchValues.push(value.toString())
      }

      clearedAccessories.push(...switchConfigs)
      homebridgeConfig.accessories = clearedAccessories
      fs.writeFileSync(homebridgeConfigPath, JSON.stringify(homebridgeConfig, null, 2));

      // console.log(switchConfigs)



    })
  })

})


exec('pm2 restart homebridge', execCallback);

function execCallback(err, stdout, stderr) {
  if (err) console.log(err);
  if (stdout) console.log(stdout);
  if (stderr) console.log(stderr);
}