require("dotenv").config({ path: "config/config.env" });
const express = require("express");
const app = express();
const port = process.env.PORT || 3001;

const managerRoute = require('./routes/managerRoute')

app.use(managerRoute)

app.listen(port, () => {
  console.log("Server is listening at port:", port);
});