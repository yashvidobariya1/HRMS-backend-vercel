const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const cors = require('cors')

app.use(cors())
app.use(bodyParser.json());
// require("./db").connect();
require("dotenv").config();

let port = process.env.PORT || 3001;

const managerRoute = require('./routes/managerRoute');
const superAdminRoute = require('./routes/superAdminRoute');
const { auth } = require('./middleware/authenticate');
const administratorRoute = require('./routes/administratorRoute');
const employeeRoute = require('./routes/employeeRoute');

// app.use(auth)
app.use(managerRoute)
app.use(superAdminRoute)
app.use(administratorRoute)
app.use(employeeRoute)

app.listen(port, () => {
  console.log("Server is listening at port:", port)
});

app.get("/", (req, res) => {
  res.send('HRMS BACKEND')
})

module.exports = app