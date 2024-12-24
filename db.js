const mongoose = require('mongoose');
require("dotenv").config();
const{ MONGO_DB_URL }=process.env;

exports.connect = () => {
  mongoose.connect(MONGO_DB_URL)
      .then(() => {
          console.log("Database connection successful");
      })
      .catch((error) => {
          console.error("Database connection failed. Exiting now...", error.message);
          console.error(error);
      });
};
