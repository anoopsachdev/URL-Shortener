// single responsibility principle
// responsible for:
// 1. express app initialization
// 2. middleware setup
// 3. route definations
const express = require("express");
const urlRoutes = require("./routes/url.routes");
require("dotenv").config();

const app = express();
// middleware
app.use(express.json());

// register routes
app.use("/api/urls", urlRoutes);


// global error handling middleware
const errorMiddleware = require("./middlewares/error.middleware");
app.use(errorMiddleware);

module.exports = app;

