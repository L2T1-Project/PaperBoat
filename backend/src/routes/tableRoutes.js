const express = require('express');
const router = express.Router();
const {runWithLogging} = require('../utils/runWithLogging.js');
const CreateTables = require('../models/createTables.js')

const createTables = new CreateTables();

router.get('/checkDBconnection', createTables.checkConnection);

module.exports = router;