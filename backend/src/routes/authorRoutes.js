const { Router } = require("express");
const AuthorController = require("../controllers/authorController.js");

class AuthorRouter {
  constructor() {
    this.router = Router();
    this.authorController = new AuthorController();
    this.#initRoutes();
  }

  #initRoutes() {
    //researcher register er jonno
    this.router.get("/lookup/orc-id", this.authorController.lookupByOrcId);
    this.router.get("/lookup/name", this.authorController.lookupByName);

    this.router.get("/paper/:paperId", this.authorController.getAuthorsByPaper);

    this.router.post("/", this.authorController.createAuthor);
    this.router.get("/", this.authorController.getAllAuthors);
    this.router.get("/:id", this.authorController.getAuthorById);
    this.router.put("/:id", this.authorController.updateAuthor);
    this.router.delete("/:id", this.authorController.deleteAuthor);

    this.router.get("/:id/profile", this.authorController.getAuthorProfile);
    this.router.get("/:id/papers", this.authorController.getPapersByAuthor);
    this.router.get("/:id/collaborators", this.authorController.getCollaboratorsByAuthor);
    this.router.post("/:id/papers", this.authorController.createPaperAuthor);
    this.router.delete(
      "/:id/papers/:paperId",
      this.authorController.deletePaperAuthor,
    );
  }

  getRouter() {
    return this.router;
  }
}

module.exports = AuthorRouter;
