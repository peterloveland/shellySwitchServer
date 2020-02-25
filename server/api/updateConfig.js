const fs = require('fs');





module.exports = function(app){
  const file = require(app.rulesConfig);
  file.key = "new value2";
  app.get('/api/v1/addRoom', (req, res) => {
    fs.writeFile(app.rulesConfig, JSON.stringify(file, null, 2), function writeJSON(err) {
      if (err) return console.log(err);
      console.log(JSON.stringify(file));
      console.log('writing to ' + app.rulesConfig);
      res.status(200)
    });
    res.status(200).send({
      success: 'true'
    })
  })

  // app.get('/api/v1/removeRoom', (req, res) => {
  //   fs.writeFile(fileName, JSON.stringify(file, null, 2), function writeJSON(err) {
  //     if (err) return console.log(err);
  //     console.log(JSON.stringify(file));
  //     console.log('writing to ' + fileName);
  //     res.status(200)
  //   });
  //   res.status(200).send({
  //     success: 'true'
  //   })
  // })


//   app.get('/api/v1/updateRoom', (req, res) => {
//     fs.readFile(fileName, 'utf8', (err, jsonString) => {
//       if (err) {
//           console.log("File read failed:", err)
//           return
//       }
//       console.log('File data:', jsonString) 
//   })
//     fs.writeFile(fileName, JSON.stringify(file, null, 2), function writeJSON(err) {
//       if (err) return console.log(err);
//       console.log(JSON.stringify(file));
//       console.log('writing to ' + fileName);
//       res.status(200)
//     });
//     res.status(200).send({
//       success: 'true'
//     })
//   })
}
