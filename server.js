const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const cors = require('cors')

app.use(cors())
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }))
require("./db").connect();
require("dotenv").config();
// require('./reminder/cron')

app.set("view engine", "ejs");

let port = process.env.PORT || 3001;

const managerRoute = require('./routes/managerRoute');
const superAdminRoute = require('./routes/superAdminRoute');
const employeeRoute = require('./routes/employeeRoute');
const commonRoute = require('./routes/commonRoute');
const clientRoute = require('./routes/clientRoute');

app.use(managerRoute)
app.use(superAdminRoute)
app.use(employeeRoute)
app.use(commonRoute)
app.use(clientRoute)

app.listen(port, () => {
  console.log("Server is listening at port:", port)
});

app.get("/", (req, res) => {
  res.send('City Clean London BACK-END')
})

module.exports = app