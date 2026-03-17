const { Router } = require("express");
const UserController = require("../controllers/userController.js");

class UserRouter {
  constructor() {
    this.router = Router();
    this.userController = new UserController();
    this.#initRoutes();
  }

  #initRoutes() {
    this.router.post("/login", this.userController.login);
    this.router.get("/statuses", this.userController.getAllStatuses);
    this.router.get("/status/all", this.userController.getAllStatuses);
    this.router.get("/verify", this.userController.verifyToken);
    this.router.post("/logout", this.userController.logout);
    this.router.post("/change-password", this.userController.changePassword);

    this.router.post("/", this.userController.createUser);
    this.router.get("/", this.userController.getAllUsers);
    this.router.get("/:id/display-name", this.userController.getUserDisplayName);
    this.router.get("/:id", this.userController.getUserById);
    this.router.put("/:id", this.userController.updateUser);
    this.router.delete("/:id", this.userController.deleteUser);

    this.router.post("/:id/follow", this.userController.followUser);
    this.router.delete("/:id/follow", this.userController.unfollowUser);
    this.router.get("/:id/followers", this.userController.getFollowers);
    this.router.get("/:id/following", this.userController.getFollowing);
    this.router.get("/:id/library", this.userController.getUserLibrary);
    this.router.post("/:id/library", this.userController.addToUserLibrary);
    this.router.delete(
      "/:id/library/:paperId",
      this.userController.removeFromUserLibrary,
    );

    this.router.get("/feedback/:id", this.userController.getFeedbackById);
    this.router.post("/feedback", this.userController.createFeedback);
    this.router.get(
      "/:id/feedback/sent",
      this.userController.getFeedbackBySender,
    );
    this.router.get(
      "/:id/feedback/received",
      this.userController.getFeedbackByReceiver,
    );
    this.router.delete("/feedback/:id", this.userController.deleteFeedback);
  }

  getRouter() {
    return this.router;
  }
}

module.exports = UserRouter;
