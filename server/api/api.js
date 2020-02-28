var express = require('express')

var cors = require("cors");
var rulesConfig = require('../../data/motionRules.json');

const app = express();

app.use(cors());
app.rulesConfig = '../../data/motionRules.json'





app.get('/api/v1/all_rooms', (req, res) => {
  
  let allRoomObjects = rulesConfig.rooms
  let allRooms = {}
  for (id in allRoomObjects) {
    allRooms[id] = {
      "label": allRoomObjects[id].title
    }
  }

  res.status(200).send({
    success: 'true',
    message: 'rooms received successfully',
    rooms: allRooms
  })
});

app.get('/api/v1/room', (req, res) => {
  let roomID = req.query.roomID
  res.status(200).send({
    success: 'true',
    message: 'rooms received successfully',
    room: rulesConfig.rooms[roomID]
  })
  console.log(rulesConfig.rooms[roomID])
});

app.get('/api/v1/sensors', (req, res) => {
  let roomID = req.query.roomID
  res.status(200).send({
    success: 'true',
    message: 'rooms received successfully',
    room: rulesConfig.rooms[roomID].sensors
  })
});

app.get('/api/v1/timePeriods', (req, res) => {
  let roomID = req.query.roomID
  res.status(200).send({
    success: 'true',
    message: 'rooms received successfully',
    room: rulesConfig.rooms[roomID].timePeriods
  })
});

var updateConfig = require('./updateConfig.js')(app);

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`)
});