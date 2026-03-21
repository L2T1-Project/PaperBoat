const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");
const AuthenticateToken = require("./middlewares/authenticateToken.js");

//cors = cross origin resource sharing

dotenv.config({ path: path.resolve(__dirname, "../.env") });
const CreateTables = require("./models/createTables.js");
const UserRouter = require("./routes/userRoutes.js");
const PaperRouter = require("./routes/paperRoutes.js");
const AuthorRouter = require("./routes/authorRoutes.js");
const InstituteRouter = require("./routes/instituteRoutes.js");
const ResearcherRouter = require("./routes/researcherRoutes.js");
const AdminRouter = require("./routes/adminRoutes.js");
const VenueRouter = require("./routes/venueRoutes.js");
const VenueUserRouter = require("./routes/venueUserRoutes.js");
const TopicRouter = require("./routes/topicRoutes.js");
const ReviewRouter = require("./routes/reviewRoutes.js");
const NotificationRouter = require("./routes/notificationRoutes.js");
const FollowRouter = require("./routes/followRoutes.js");
const FeedbackRouter = require("./routes/feedbackRoutes.js");
const LibraryRouter = require("./routes/libraryRoutes.js");

const app = express();
app.use(express.json());
app.use(cors());

const authInstance = new AuthenticateToken();
const publicRoutes = [
  { method: "POST", path: "/api/users/login" },
  { method: "POST", path: "/api/users" },
  { method: "GET", path: "/api/users/statuses" },
  { method: "GET", path: "/api/users/status/all" },
  { method: "GET", path: "/api/authors/lookup/orc-id" },
  { method: "GET", path: "/api/authors/lookup/name" },
  { method: "GET", path: "/api/authors" },
  { method: "GET", path: "/api/authors/:id" },
  { method: "GET", path: "/api/authors/:id/profile" },
  { method: "GET", path: "/api/authors/:id/papers" },
  { method: "GET", path: "/api/authors/:id/collaborators" },
  { method: "GET", path: "/api/authors/:id/institutes" },
  { method: "GET", path: "/api/authors/paper/:paperId" },
  { method: "POST", path: "/api/researchers" },
  { method: "GET", path: "/api/venues/lookup/issn" },
  { method: "GET", path: "/api/venues/lookup/name" },
  { method: "POST", path: "/api/venue-users" },
  { method: "GET", path: "/api/papers" },
  { method: "GET", path: "/api/papers/search" },
  { method: "GET", path: "/api/papers/domain/:domainId" },
  { method: "GET", path: "/api/papers/field/:fieldId" },
  { method: "GET", path: "/api/papers/topic/:topicId" },
  { method: "GET", path: "/api/papers/:id" },
  { method: "GET", path: "/api/papers/:id/topics" },
  { method: "GET", path: "/api/topics" },
  { method: "GET", path: "/api/topics/domains" },
  { method: "GET", path: "/api/topics/domains/:domainId/fields" },
  { method: "GET", path: "/api/topics/fields/:fieldId/topics" },
  { method: "GET", path: "/api/venues" },
  { method: "GET", path: "/api/venues/:id" },
  { method: "GET", path: "/api/venues/:id/stats" },
  { method: "GET", path: "/api/venues/:id/papers" },
  { method: "GET", path: "/api/venues/:id/authors" },
];

function doesPathMatch(routePath, requestPath) {
  const routeParts = routePath.split("/").filter(Boolean);
  const requestParts = requestPath.split("/").filter(Boolean);

  if (routeParts.length !== requestParts.length) {
    return false;
  }

  for (let i = 0; i < routeParts.length; i += 1) {
    const routePart = routeParts[i];
    const requestPart = requestParts[i];

    if (routePart.startsWith(":")) {
      continue;
    }

    if (routePart !== requestPart) {
      return false;
    }
  }

  return true;
}

app.use((req, res, next) => {
  const isPublic = publicRoutes.some(
    (route) =>
      route.method === req.method && doesPathMatch(route.path, req.path),
  );

  if (isPublic) {
    return next();
  }

  return authInstance.authenticateToken(req, res, next);
});

// Tables have been created like this, will create a new route later
const check = new CreateTables();
// check.checkConnection();

// Routes
const userRouter = new UserRouter();
app.use("/api/users", userRouter.getRouter());

const paperRouter = new PaperRouter();
app.use("/api/papers", paperRouter.getRouter());

const authorRouter = new AuthorRouter();
app.use("/api/authors", authorRouter.getRouter());

const instituteRouter = new InstituteRouter();
app.use("/api/institutes", instituteRouter.getRouter());

const researcherRouter = new ResearcherRouter();
app.use("/api/researchers", researcherRouter.getRouter());

const adminRouter = new AdminRouter();
app.use("/api/admin", adminRouter.getRouter());

const venueRouter = new VenueRouter();
app.use("/api/venues", venueRouter.getRouter());

const venueUserRouter = new VenueUserRouter();
app.use("/api/venue-users", venueUserRouter.getRouter());

const topicRouter = new TopicRouter();
app.use("/api/topics", topicRouter.getRouter());

const reviewRouter = new ReviewRouter();
app.use("/api/reviews", reviewRouter.getRouter());

const notificationRouter = new NotificationRouter();
app.use("/api/notifications", notificationRouter.getRouter());

const followRouter = new FollowRouter();
app.use("/api/follows", followRouter.getRouter());

const feedbackRouter = new FeedbackRouter();
app.use("/api/feedback", feedbackRouter.getRouter());

const libraryRouter = new LibraryRouter();
app.use("/api/library", libraryRouter.getRouter());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

//console.log(process.env.DATABASE_URL);
