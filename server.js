const express = require('express');
const app = express();

let port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log("Server is listening at port:", port)
});