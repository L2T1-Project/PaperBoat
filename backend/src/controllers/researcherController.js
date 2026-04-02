const ResearcherModel = require("../models/researcherModel.js");
const UserModel = require("../models/userModel.js");
const FeedbackModel = require("../models/feedbackModel.js");
const PaperModel = require("../models/paperModel.js");
const NotificationModel = require("../models/notificationModel.js");
const { normalizeAndValidateOrcId } = require("../utils/orcidUtils.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

class ResearcherController {
  constructor() {
    this.researcherModel = new ResearcherModel();
    this.userModel = new UserModel();
    this.feedbackModel = new FeedbackModel();
    this.paperModel = new PaperModel();
    this.notificationModel = new NotificationModel();
  }

  ensureResearcherSelf = (req, res, researcherId) => {
    if (req.user?.role !== "researcher") {
      return res.status(403).json({ success: false, message: "Only researchers can access claims." });
    }

    if (Number(req.auth?.userId) !== Number(researcherId)) {
      return res.status(403).json({ success: false, message: "Forbidden: you can only access your own claims." });
    }

    return null;
  };

  createResearcher = async (req, res) => {
    try {
      const {
        full_name,
        username,
        email,
        password,
        phone_number,
        bio,
        author_id,
      } = req.body;

      if (!full_name || !username || !email || !password || !author_id) {
        return res.status(400).json({
          error:
            "full_name, username, email, password, and author_id are required.",
        });
      }

      const status = await this.userModel.ensureStatusByName("active");
      if (!status) {
        return res
          .status(500)
          .json({ error: "Could not resolve active status." });
      }

      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;
      const password_hash = await bcrypt.hash(password, saltRounds);

      const user = await this.researcherModel.signupResearcher({
        username,
        full_name,
        email,
        password_hash,
        phone_number: phone_number || null,
        status_id: status.id,
        bio: bio || null,
        author_id: Number(author_id),
      });

      const token = jwt.sign(
        { userId: user.id, role: "researcher" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" },
      );

      await this.userModel.updateJwtToken(user.id, token);

      return res.status(201).json({
        token,
        role: "researcher",
        userId: user.id,
      });
    } catch (error) {
      if (error.code === "23505") {
        if (error.detail && error.detail.includes("email")) {
          return res.status(409).json({ error: "Email already in use." });
        }
        if (error.detail && error.detail.includes("username")) {
          return res.status(409).json({ error: "Username already taken." });
        }
        if (error.detail && error.detail.includes("author_id")) {
          return res
            .status(409)
            .json({ error: "This author profile has already been claimed." });
        }
      }

      return res.status(500).json({ error: "Internal server error." });
    }
  };

  getAllResearchers = async (req, res) => {
    try {
      const researchers = await this.researcherModel.getAllResearchers();
      return res
        .status(200)
        .json({ success: true, count: researchers.length, data: researchers });
    } catch (error) {
      console.error("[getAllResearchers]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  getResearcherById = async (req, res) => {
    try {
      const { id } = req.params;

      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "id must be a number." });
      }

      const researcher = await this.researcherModel.getResearcherById(
        Number(id),
      );

      if (!researcher) {
        return res.status(404).json({
          success: false,
          message: `Researcher with user_id ${id} not found.`,
        });
      }

      return res.status(200).json({ success: true, data: researcher });
    } catch (error) {
      console.error("[getResearcherById]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  deleteResearcher = async (req, res) => {
    try {
      const { id } = req.params;

      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "id must be a number." });
      }

      const researcher = await this.researcherModel.deleteResearcher(
        Number(id),
      );

      if (!researcher) {
        return res.status(404).json({
          success: false,
          message: `Researcher with user_id ${id} not found.`,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Researcher deleted successfully.",
        data: researcher,
      });
    } catch (error) {
      console.error("[deleteResearcher]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  createPaperClaim = async (req, res) => {
    try {
      const { id } = req.params; // researcher user_id
      const { paper_id, position } = req.body;

      const authError = this.ensureResearcherSelf(req, res, id);
      if (authError) return authError;

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

      const claim = await this.researcherModel.createPaperClaim(
        Number(id),
        Number(paper_id),
        Number(position),
      );

      return res.status(201).json({
        success: true,
        message: "Paper claim submitted.",
        data: claim,
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "This researcher has already claimed this paper.",
        });
      }
      if (error.code === "23503") {
        return res
          .status(404)
          .json({ success: false, message: "Researcher or paper not found." });
      }
      console.error("[createClaim]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  getPaperClaimsByResearcher = async (req, res) => {
    try {
      const { id } = req.params;

      const authError = this.ensureResearcherSelf(req, res, id);
      if (authError) return authError;

      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "id must be a number." });
      }

      const claims = await this.researcherModel.getPaperClaimsByResearcher(
        Number(id),
      );
      return res
        .status(200)
        .json({ success: true, count: claims.length, data: claims });
    } catch (error) {
      console.error("[getClaimsByResearcher]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  deletePaperClaim = async (req, res) => {
    try {
      const { id, paperId } = req.params;

      const authError = this.ensureResearcherSelf(req, res, id);
      if (authError) return authError;

      if (isNaN(id) || isNaN(paperId)) {
        return res
          .status(400)
          .json({ success: false, message: "id and paperId must be numbers." });
      }

      const claim = await this.researcherModel.deletePaperClaim(
        Number(id),
        Number(paperId),
      );

      if (!claim) {
        return res
          .status(404)
          .json({ success: false, message: "Claim not found." });
      }

      return res
        .status(200)
        .json({ success: true, message: "Claim retracted.", data: claim });
    } catch (error) {
      console.error("[deleteClaim]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  addInstituteHistory = async (req, res) => {
    try {
      const { id } = req.params; // researcher user_id
      const { institute_id, from_date, upto_date } = req.body;

      const authError = this.ensureResearcherSelf(req, res, id);
      if (authError) return authError;

      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "id must be a number." });
      }
      if (!institute_id || isNaN(institute_id)) {
        return res.status(400).json({
          success: false,
          message: "institute_id is required and must be a number.",
        });
      }
      if (!from_date) {
        return res
          .status(400)
          .json({ success: false, message: "from_date is required." });
      }

      const entry = await this.researcherModel.addInstituteHistory(
        Number(id),
        Number(institute_id),
        from_date,
        upto_date || null,
      );

      return res.status(201).json({
        success: true,
        message: "Institute affiliation added.",
        data: entry,
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "This affiliation record already exists.",
        });
      }
      if (error.code === "23503") {
        return res.status(404).json({
          success: false,
          message: "Researcher or institute not found.",
        });
      }
      if (error.code === "23514") {
        return res.status(400).json({
          success: false,
          message: "upto_date must be on or after from_date.",
        });
      }
      if (error.code === "P0001") {
        return res.status(400).json({
          success: false,
          message: "Affiliation dates overlap with existing history. End the current affiliation before adding a new overlapping period.",
        });
      }
      console.error("[addInstituteHistory]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  getInstituteHistory = async (req, res) => {
    try {
      const { id } = req.params;

      const authError = this.ensureResearcherSelf(req, res, id);
      if (authError) return authError;

      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "id must be a number." });
      }

      const history = await this.researcherModel.getInstituteHistory(
        Number(id),
      );
      return res
        .status(200)
        .json({ success: true, count: history.length, data: history });
    } catch (error) {
      console.error("[getInstituteHistory]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  updateInstituteHistory = async (req, res) => {
    try {
      const { id, instituteId } = req.params;
      const { from_date, upto_date } = req.body;

      const authError = this.ensureResearcherSelf(req, res, id);
      if (authError) return authError;

      if (isNaN(id) || isNaN(instituteId)) {
        return res.status(400).json({
          success: false,
          message: "id and instituteId must be numbers.",
        });
      }
      if (!from_date) {
        return res.status(400).json({
          success: false,
          message: "from_date is required to identify the record.",
        });
      }
      if (!upto_date) {
        return res
          .status(400)
          .json({ success: false, message: "upto_date is required." });
      }

      const entry = await this.researcherModel.updateInstituteHistory(
        Number(id),
        Number(instituteId),
        from_date,
        upto_date,
      );

      if (!entry) {
        return res
          .status(404)
          .json({ success: false, message: "Affiliation record not found." });
      }

      return res.status(200).json({
        success: true,
        message: "Affiliation updated.",
        data: entry,
      });
    } catch (error) {
      if (error.code === "23514") {
        return res.status(400).json({
          success: false,
          message: "upto_date must be on or after from_date.",
        });
      }
      if (error.code === "P0001") {
        return res.status(400).json({
          success: false,
          message: "Affiliation dates overlap with existing history.",
        });
      }
      console.error("[updateInstituteHistory]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  removeInstituteHistory = async (req, res) => {
    try {
      const { id, instituteId } = req.params;
      const { from_date } = req.body;

      const authError = this.ensureResearcherSelf(req, res, id);
      if (authError) return authError;

      if (isNaN(id) || isNaN(instituteId)) {
        return res.status(400).json({
          success: false,
          message: "id and instituteId must be numbers.",
        });
      }
      if (!from_date) {
        return res.status(400).json({
          success: false,
          message: "from_date is required to identify the record.",
        });
      }

      const entry = await this.researcherModel.removeInstituteHistory(
        Number(id),
        Number(instituteId),
        from_date,
      );

      if (!entry) {
        return res
          .status(404)
          .json({ success: false, message: "Affiliation record not found." });
      }

      return res
        .status(200)
        .json({ success: true, message: "Affiliation removed.", data: entry });
    } catch (error) {
      console.error("[removeInstituteHistory]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  getDashboardPapers = async (req, res) => {
    try {
      const { id } = req.params;
      const { limit = 5, offset = 0 } = req.query;

      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "id must be a number." });
      }

      if (req.auth?.userId !== Number(id)) {
        return res.status(403).json({ success: false, message: "Forbidden." });
      }

      const safeLimit = Math.min(100, Math.max(1, Number(limit) || 5));
      const safeOffset = Math.max(0, Number(offset) || 0);

      const papers = await this.researcherModel.getDashboardPapers(
        Number(id),
        safeLimit,
        safeOffset,
      );

      return res
        .status(200)
        .json({ success: true, count: papers.length, data: papers });
    } catch (error) {
      console.error("[getDashboardPapers]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  submitPaperSuggestion = async (req, res) => {
    try {
      const { id } = req.params;
      const { title, publication_date, doi, pdf_url, github_repo, venue_id, topic_id, authors, is_retracted, notes } = req.body;

      const authError = this.ensureResearcherSelf(req, res, id);
      if (authError) return authError;

      if (!title?.trim() || !publication_date || !venue_id || isNaN(venue_id) || !topic_id || isNaN(topic_id)) {
        return res.status(400).json({
          success: false,
          message: "title, publication_date, numeric venue_id and numeric topic_id are required.",
        });
      }

      if (!Array.isArray(authors) || authors.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one author is required.",
        });
      }

      const normalizedAuthors = [];
      for (let index = 0; index < authors.length; index += 1) {
        const entry = authors[index];
        const { normalizedOrcId, error: orcError } = normalizeAndValidateOrcId(entry?.orc_id);
        if (orcError) {
          return res.status(400).json({
            success: false,
            message: `Invalid ORCID for author at row ${index + 1}: ${orcError}`,
          });
        }

        normalizedAuthors.push({
          author_id: entry?.author_id ? Number(entry.author_id) : null,
          name: entry?.name?.trim() || null,
          position: Number(entry?.position),
          orc_id: normalizedOrcId,
        });
      }

      const invalidAuthor = normalizedAuthors.find((entry) => {
        const hasExisting = Number.isInteger(entry.author_id) && entry.author_id > 0;
        const hasName = Boolean(entry.name);
        const validPosition = Number.isInteger(entry.position) && entry.position > 0;
        return !validPosition || (!hasExisting && !hasName);
      });

      if (invalidAuthor) {
        return res.status(400).json({
          success: false,
          message: "Each author must have a valid position and either selected existing author or a new author name.",
        });
      }

      const uniquePositions = new Set(normalizedAuthors.map((entry) => entry.position));
      if (uniquePositions.size !== normalizedAuthors.length) {
        return res.status(400).json({
          success: false,
          message: "Author positions must be unique.",
        });
      }

      const duplicatePapers = await this.paperModel.findDuplicateCandidates(title, doi || null);
      if (duplicatePapers.length) {
        return res.status(409).json({
          success: false,
          message: "Similar paper already exists in the catalog.",
          data: { duplicates: duplicatePapers },
        });
      }

      const duplicateSuggestions = await this.feedbackModel.findPendingPaperSuggestionDuplicates(title, doi || null);
      if (duplicateSuggestions.length) {
        return res.status(409).json({
          success: false,
          message: "A similar pending suggestion is already in the admin queue.",
          data: { duplicates: duplicateSuggestions.map((row) => ({ id: row.id, created_at: row.created_at, sender_name: row.sender_name })) },
        });
      }

      const adminUserId = await this.feedbackModel.getAnyAdminUserId();
      if (!adminUserId) {
        return res.status(503).json({ success: false, message: "No admin available to review suggestions." });
      }

      const suggestionPayload = {
        title: title.trim(),
        publication_date,
        doi: doi?.trim() || null,
        pdf_url: pdf_url?.trim() || null,
        github_repo: github_repo?.trim() || null,
        venue_id: Number(venue_id),
        topic_id: Number(topic_id),
        authors: normalizedAuthors,
        is_retracted: Boolean(is_retracted),
        notes: notes?.trim() || null,
      };

      const suggestion = await this.feedbackModel.createPaperSuggestion(Number(id), adminUserId, suggestionPayload);

      const senderName = req.user?.full_name || "A researcher";
      this.notificationModel
        .notifyAdminNewFeedback(suggestion.id, adminUserId, senderName)
        .catch((err) => console.error("paper suggestion admin notif error:", err));

      return res.status(201).json({
        success: true,
        message: "Paper suggestion submitted for admin review.",
        data: {
          id: suggestion.id,
          created_at: suggestion.created_at,
          suggestion_status: "pending",
          suggested_paper: suggestionPayload,
        },
      });
    } catch (error) {
      console.error("[submitPaperSuggestion]", error.message);
      return res.status(500).json({ success: false, message: "Internal server error." });
    }
  };

  getMyPaperSuggestions = async (req, res) => {
    try {
      const { id } = req.params;
      const authError = this.ensureResearcherSelf(req, res, id);
      if (authError) return authError;

      const suggestions = await this.feedbackModel.getPaperSuggestionsBySender(Number(id));
      const data = suggestions.map((row) => {
        let suggestedPaper = null;
        let moderationNote = row.response || null;
        if (typeof moderationNote === "string" && moderationNote.startsWith("APPROVED::")) {
          moderationNote = moderationNote.split("::")[2] || null;
        } else if (typeof moderationNote === "string" && moderationNote.startsWith("REJECTED::")) {
          moderationNote = moderationNote.slice("REJECTED::".length) || null;
        }
        try {
          suggestedPaper = JSON.parse(row.message);
        } catch {
          suggestedPaper = null;
        }

        return {
          id: row.id,
          created_at: row.created_at,
          responded_at: row.responded_at,
          suggestion_status: row.suggestion_status,
          moderation_note: moderationNote,
          suggested_paper: suggestedPaper,
        };
      });

      return res.status(200).json({ success: true, count: data.length, data });
    } catch (error) {
      console.error("[getMyPaperSuggestions]", error.message);
      return res.status(500).json({ success: false, message: "Internal server error." });
    }
  };
}

module.exports = ResearcherController;
