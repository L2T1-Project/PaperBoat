const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');

//cors = cross origin resource sharing

const CreateTables =require('./models/createTables.js')
dotenv.config({path: path.resolve(__dirname, '../.env')});

const app = express();
app.use(express.json());
app.use(cors());

// Tables have been created like this, will create a new route later
const check  = new CreateTables();
check.checkConnection();


//console.log(process.env.DATABASE_URL);