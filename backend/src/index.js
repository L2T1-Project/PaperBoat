const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');

//cors = cross origin resource sharing

dotenv.config({path: path.resolve(__dirname, '../.env')});
const CreateTables = require('./models/createTables.js');
const UserRouter = require('./routes/userRoutes.js');

const app = express();
app.use(express.json());
app.use(cors());

// Tables have been created like this, will create a new route later
const check = new CreateTables();
// check.checkConnection();

// Routes
const userRouter = new UserRouter();
app.use('/api/users', userRouter.getRouter());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

//console.log(process.env.DATABASE_URL);
