const { Router } = require("express");
const UserController = require("../controllers/userController.js");
const uploadProfileImage = require("../middlewares/uploadProfileImage.js");

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
    this.router.get("/me/profile", this.userController.getMyProfile);
    this.router.patch("/me/profile", this.userController.updateMyProfile);
    this.router.post(
      "/me/profile-photo",
      uploadProfileImage.single("image"),
      this.userController.uploadMyProfilePhoto,
    );
    this.router.get("/:id/display-name", this.userController.getUserDisplayName);
    this.router.get("/:id", this.userController.getUserById);
    this.router.put("/:id", this.userController.updateUser);
    this.router.delete("/:id", this.userController.deleteUser);
  }

  getRouter() {
    return this.router;
  }
}

module.exports = UserRouter;
