const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());
require("./db").connect();
require("dotenv").config();

let port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log("Server is listening at port:", port)
});

app.get("/", (req, res) => {
  res.send('HRMS BACKEND')
})