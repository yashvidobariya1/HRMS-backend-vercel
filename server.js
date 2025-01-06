const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const cors = require('cors')

app.use(cors())
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }))
require("./db").connect();
require("dotenv").config();

let port = process.env.PORT || 3001;

const managerRoute = require('./routes/managerRoute');
const superAdminRoute = require('./routes/superAdminRoute');
const administratorRoute = require('./routes/administratorRoute');
const employeeRoute = require('./routes/employeeRoute');
const commonRoute = require('./routes/commonRoute');

// app.use(auth)
app.use(managerRoute)
app.use(superAdminRoute)
app.use(administratorRoute)
app.use(employeeRoute)
app.use(commonRoute)

app.listen(port, () => {
  console.log("Server is listening at port:", port)
});

app.get("/", (req, res) => {
  res.send('HRMS BACKEND')
})

module.exports = app