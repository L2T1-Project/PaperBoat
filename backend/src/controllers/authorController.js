const AuthorModel = require("../models/authorModel.js");

class AuthorController {
  constructor() {
    this.authorModel = new AuthorModel();
  }

  createAuthor = async (req, res) => {
    try {
      const { name, orc_id } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: "name is required.",
        });
      }

      const author = await this.authorModel.createAuthor({ name, orc_id });

      return res.status(201).json({
        success: true,
        message: "Author created successfully.",
        data: author,
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "An author with that orc_id already exists.",
        });
      }
      console.error("[createAuthor]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  getAllAuthors = async (req, res) => {
    try {
      const { orc_id, name } = req.query;

      if (orc_id) {
        const author = await this.authorModel.getAuthorByOrcId(orc_id);
        if (!author) {
          return res
            .status(404)
            .json({ error: "No author found with this ORCID." });
        }

        const claimed = await this.authorModel.isAuthorClaimed(author.id);
        if (claimed) {
          return res.status(409).json({
            error:
              "This ORCID is already associated with an account. Please contact support.",
          });
        }

        return res
          .status(200)
          .json({ id: author.id, name: author.name, orc_id: author.orc_id });
      }

      if (name) {
        const authors = await this.authorModel.getAuthorsByName(name);
        if (authors.length === 0) {
          return res
            .status(404)
            .json({ error: "No authors found with this name." });
        }

        const formatted = authors.map((author) => ({
          id: author.id,
          name: author.name,
          orc_id: author.orc_id,
          latest_paper: author.paper_id
            ? { id: author.paper_id, title: author.paper_title }
            : null,
        }));

        return res.status(200).json(formatted);
      }

      const authors = await this.authorModel.getAllAuthors();
      return res
        .status(200)
        .json({ success: true, count: authors.length, data: authors });
    } catch (error) {
      console.error("[getAllAuthors]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  getAuthorById = async (req, res) => {
    try {
      const { id } = req.params;

      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "id must be a number." });
      }

      const author = await this.authorModel.getAuthorById(Number(id));

      if (!author) {
        return res.status(404).json({
          success: false,
          message: `Author with id ${id} not found.`,
        });
      }

      return res.status(200).json({ success: true, data: author });
    } catch (error) {
      console.error("[getAuthorById]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  updateAuthor = async (req, res) => {
    try {
      const { id } = req.params;

      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "id must be a number." });
      }

      const { name, orc_id } = req.body;

      if (!name) {
        return res
          .status(400)
          .json({ success: false, message: "name is required." });
      }

      const author = await this.authorModel.updateAuthor(Number(id), {
        name,
        orc_id,
      });

      if (!author) {
        return res.status(404).json({
          success: false,
          message: `Author with id ${id} not found.`,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Author updated successfully.",
        data: author,
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "An author with that orc_id already exists.",
        });
      }
      console.error("[updateAuthor]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  deleteAuthor = async (req, res) => {
    try {
      const { id } = req.params;

      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "id must be a number." });
      }

      const author = await this.authorModel.deleteAuthor(Number(id));

      if (!author) {
        return res.status(404).json({
          success: false,
          message: `Author with id ${id} not found.`,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Author deleted successfully.",
        data: author,
      });
    } catch (error) {
      console.error("[deleteAuthor]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  getPapersByAuthor = async (req, res) => {
    try {
      const { id } = req.params;

      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "id must be a number." });
      }

      const papers = await this.authorModel.getPapersByAuthor(Number(id));
      return res
        .status(200)
        .json({ success: true, count: papers.length, data: papers });
    } catch (error) {
      console.error("[getPapersByAuthor]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  getAuthorsByPaper = async (req, res) => {
    try {
      const { paperId } = req.params;

      if (isNaN(paperId)) {
        return res
          .status(400)
          .json({ success: false, message: "paperId must be a number." });
      }

      const authors = await this.authorModel.getAuthorsByPaper(Number(paperId));
      return res
        .status(200)
        .json({ success: true, count: authors.length, data: authors });
    } catch (error) {
      console.error("[getAuthorsByPaper]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  createPaperAuthor = async (req, res) => {
    try {
      const { id } = req.params; // author id
      const { paper_id, position } = req.body;

      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "id must be a number." });
      }
      if (!paper_id || isNaN(paper_id)) {
        return res.status(400).json({
          success: false,
          message: "paper_id is required and must be a number.",
        });
      }
      if (!position || isNaN(position) || Number(position) < 1) {
        return res.status(400).json({
          success: false,
          message: "position is required and must be a positive integer.",
        });
      }

      const link = await this.authorModel.createPaperAuthor(
        Number(id),
        Number(paper_id),
        Number(position),
      );

      return res.status(201).json({
        success: true,
        message: "Author linked to paper.",
        data: link,
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "This author is already linked to that paper.",
        });
      }
      if (error.code === "23503") {
        return res
          .status(404)
          .json({ success: false, message: "Author or paper not found." });
      }
      console.error("[linkAuthorToPaper]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  deletePaperAuthor = async (req, res) => {
    try {
      const { id, paperId } = req.params;

      if (isNaN(id) || isNaN(paperId)) {
        return res
          .status(400)
          .json({ success: false, message: "id and paperId must be numbers." });
      }

      const link = await this.authorModel.deletePaperAuthor(
        Number(id),
        Number(paperId),
      );

      if (!link) {
        return res
          .status(404)
          .json({ success: false, message: "Author-paper link not found." });
      }

      return res.status(200).json({
        success: true,
        message: "Author unlinked from paper.",
        data: link,
      });
    } catch (error) {
      console.error("[unlinkAuthorFromPaper]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  lookupByOrcId = async (req, res) => {
    try {
      const { orc_id } = req.query;

      if (!orc_id) {
        return res.status(400).json({
          success: false,
          message: "orc_id query parameter is required.",
        });
      }

      const author = await this.authorModel.getAuthorByOrcId(orc_id);

      if (!author) {
        return res
          .status(404)
          .json({ error: "No author found with this ORCID." });
      }

      const claimed = await this.authorModel.isAuthorClaimed(author.id);
      if (claimed) {
        return res.status(409).json({
          error:
            "This ORCID is already associated with an account. Please contact support.",
        });
      }

      return res
        .status(200)
        .json({ id: author.id, name: author.name, orc_id: author.orc_id });
    } catch (error) {
      console.error("[lookupByOrcId]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  lookupByName = async (req, res) => {
    try {
      const { name } = req.query;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: "name query parameter is required.",
        });
      }

      const authors = await this.authorModel.getAuthorsByName(name);
      if (authors.length === 0) {
        return res
          .status(404)
          .json({ error: "No authors found with this name." });
      }

      const formatted = authors.map((author) => ({
        id: author.id,
        name: author.name,
        orc_id: author.orc_id,
        latest_paper: author.paper_id
          ? { id: author.paper_id, title: author.paper_title }
          : null,
      }));

      return res.status(200).json(formatted);
    } catch (error) {
      console.error("[lookupByName]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };
  getAuthorProfile = async (req, res) => {
    try {
      const { id } = req.params;
      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "id must be a number." });
      }
      const profile = await this.authorModel.getAuthorProfile(Number(id));
      if (!profile) {
        return res.status(404).json({
          success: false,
          message: `Author with id ${id} not found.`,
        });
      }
      return res.status(200).json({ success: true, data: profile });
    } catch (error) {
      console.error("[getAuthorProfile]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };
}

module.exports = AuthorController;
