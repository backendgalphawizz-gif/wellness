require("dotenv").config();

const path = require("path");
const fs = require("fs");
const https = require("https");
const express = require("express");
const cors = require("cors");

const config = require("./config");
const { connectDatabase } = require("./config/db");
const routes = require("./routes");
const { notFound } = require("./middleware/notFound");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

const options = {

  cert: fs.readFileSync("/var/cpanel/ssl/domain_tls/wellness.developmentalphawizz.com/combined"),

  key: fs.readFileSync("/var/cpanel/ssl/domain_tls/wellness.developmentalphawizz.com/combined"),

};




async function start() {

  try {

    await connectDatabase();

    https.createServer(options, app).listen(5001, () => {

      console.log("HTTPS Server running on port 5001");

    });

  } catch (err) {

    console.error("Error starting server:", err.message);

    process.exit(1);

  }

}



start();



module.exports = app;

