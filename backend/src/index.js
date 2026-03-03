const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');

//cors = cross origin resource sharing

dotenv.config({path: path.resolve(__dirname, '../.env')});
const CreateTables = require('./models/createTables.js');
const UserRouter = require('./routes/userRoutes.js');
const PaperRouter = require('./routes/paperRoutes.js');
const AuthorRouter = require('./routes/authorRoutes.js');
const InstituteRouter = require('./routes/instituteRoutes.js');
const ResearcherRouter = require('./routes/researcherRoutes.js');
const AdminRouter = require('./routes/adminRoutes.js');
const VenueRouter = require('./routes/venueRoutes.js');
const VenueUserRouter = require('./routes/venueUserRoutes.js');
const TopicRouter = require('./routes/topicRoutes.js');
const ReviewRouter = require('./routes/reviewRoutes.js');

const app = express();
app.use(express.json());
app.use(cors());

// Tables have been created like this, will create a new route later
const check = new CreateTables();
// check.checkConnection();

// Routes
const userRouter = new UserRouter();
app.use('/api/users', userRouter.getRouter());

const paperRouter = new PaperRouter();
app.use('/api/papers', paperRouter.getRouter());

const authorRouter = new AuthorRouter();
app.use('/api/authors', authorRouter.getRouter());

const instituteRouter = new InstituteRouter();
app.use('/api/institutes', instituteRouter.getRouter());

const researcherRouter = new ResearcherRouter();
app.use('/api/researchers', researcherRouter.getRouter());

const adminRouter = new AdminRouter();
app.use('/api/admin', adminRouter.getRouter());

const venueRouter = new VenueRouter();
app.use('/api/venues', venueRouter.getRouter());

const venueUserRouter = new VenueUserRouter();
app.use('/api/venue-users', venueUserRouter.getRouter());

const topicRouter = new TopicRouter();
app.use('/api/topics', topicRouter.getRouter());

const reviewRouter = new ReviewRouter();
app.use('/api/reviews', reviewRouter.getRouter());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

//console.log(process.env.DATABASE_URL);
