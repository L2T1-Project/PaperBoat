const AdminModel = require('../models/adminModel.js');
const FeedbackModel = require('../models/feedbackModel.js');
const PaperModel = require('../models/paperModel.js');
const NotificationModel = require('../models/notificationModel.js');
const DB_Connection = require('../database/db.js');
const { normalizeAndValidateOrcId } = require('../utils/orcidUtils.js');

class AdminController {
    constructor() {
        this.adminModel = new AdminModel();
        this.feedbackModel = new FeedbackModel();
        this.paperModel = new PaperModel();
        this.notificationModel = new NotificationModel();
        this.db = DB_Connection.getInstance();
        this.APPROVED_STATUS_ID = 3;
        this.DECLINED_STATUS_ID = 4;
    }

    parseSuggestionPayload = (row) => {
        try {
            return JSON.parse(row.message);
        } catch {
            return null;
        }
    }

    parseModerationNote = (response) => {
        if (!response) return null;
        if (response.startsWith('APPROVED::')) {
            const chunks = response.split('::');
            return chunks[2] || null;
        }
        if (response.startsWith('REJECTED::')) {
            return response.slice('REJECTED::'.length) || null;
        }
        return response;
    }

    normalizeSuggestionRow = (row) => {
        const suggestedPaper = this.parseSuggestionPayload(row);
        return {
            id: row.id,
            sender_id: row.sender_id,
            sender_name: row.sender_name,
            sender_email: row.sender_email,
            created_at: row.created_at,
            responded_at: row.responded_at,
            suggestion_status: row.suggestion_status,
            moderation_note: this.parseModerationNote(row.response),
            suggested_paper: suggestedPaper,
        };
    }

    ensureAdmin = (req, res) => {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can access this resource.' });
        }

        return null;
    }

    promoteUser = async (req, res) => {
        try {
            const authError = this.ensureAdmin(req, res);
            if (authError) return authError;

            const { user_id } = req.body;

            if (!user_id) {
                return res.status(400).json({ error: 'user_id is required' });
            }

            const admin = await this.adminModel.createAdmin(user_id);
            return res.status(201).json(admin);
        } catch (err) {
            if (err.code === '23505') return res.status(409).json({ error: 'User is already an admin' });
            if (err.code === '23503') return res.status(400).json({ error: 'User not found' });
            console.error('AdminController.promoteUser:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getAllAdmins = async (req, res) => {
        try {
            const authError = this.ensureAdmin(req, res);
            if (authError) return authError;

            const admins = await this.adminModel.getAllAdmins();
            return res.status(200).json(admins);
        } catch (err) {
            console.error('AdminController.getAllAdmins:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getAdminById = async (req, res) => {
        try {
            const authError = this.ensureAdmin(req, res);
            if (authError) return authError;

            const { id } = req.params;
            const admin = await this.adminModel.getAdminById(id);

            if (!admin) return res.status(404).json({ error: 'Admin not found' });
            return res.status(200).json(admin);
        } catch (err) {
            console.error('AdminController.getAdminById:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    demoteAdmin = async (req, res) => {
        try {
            const authError = this.ensureAdmin(req, res);
            if (authError) return authError;

            const { id } = req.params;
            const removed = await this.adminModel.deleteAdmin(id);

            if (!removed) return res.status(404).json({ error: 'Admin not found' });
            return res.status(200).json({ message: 'Admin demoted successfully', user_id: removed.user_id });
        } catch (err) {
            console.error('AdminController.demoteAdmin:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }


    getAllPaperClaims = async (req, res) => {
        try {
            const authError = this.ensureAdmin(req, res);
            if (authError) return authError;

            const claims = await this.adminModel.getAllPaperClaims();
            return res.status(200).json({ success: true, count: claims.length, data: claims });
        } catch (err) {
            console.error('AdminController.getAllClaims:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getPaperClaimsByStatus = async (req, res) => {
        try {
            const authError = this.ensureAdmin(req, res);
            if (authError) return authError;

            const { status } = req.params;
            const claims = await this.adminModel.getPaperClaimsByStatus(status);
            return res.status(200).json({ success: true, count: claims.length, data: claims });
        } catch (err) {
            console.error('AdminController.getClaimsByStatus:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    updatePaperClaimStatus = async (req, res) => {
        try {
            const authError = this.ensureAdmin(req, res);
            if (authError) return authError;

            const { researcherId, paperId } = req.params;
            const { status_id } = req.body;

            if (isNaN(researcherId) || isNaN(paperId)) {
                return res.status(400).json({ error: 'researcherId and paperId must be numbers.' });
            }
            if (!status_id || isNaN(status_id)) {
                return res.status(400).json({ error: 'status_id is required and must be a number.' });
            }

            const nextStatusId = Number(status_id);
            if (![this.APPROVED_STATUS_ID, this.DECLINED_STATUS_ID].includes(nextStatusId)) {
                return res.status(400).json({ error: 'status_id must be 3 (Approved) or 4 (Declined).' });
            }

            const claim = await this.adminModel.processPaperClaimDecision(
                Number(researcherId),
                Number(paperId),
                nextStatusId
            );

            if (!claim) return res.status(404).json({ error: 'Paper claim not found.' });
            return res.status(200).json({ success: true, message: 'Claim status updated.', data: claim });
        } catch (err) {
            if (err.code === 'CLAIM_NOT_PENDING') {
                return res.status(409).json({ error: 'Only pending claims can be reviewed.' });
            }
            if (err.code === 'INVALID_CLAIM_STATUS') {
                return res.status(400).json({ error: 'Invalid claim status transition.' });
            }
            if (err.code === '23503') return res.status(400).json({ error: 'status_id does not exist in the status table.' });
            console.error('AdminController.updateClaimStatus:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getPaperSuggestions = async (req, res) => {
        try {
            const authError = this.ensureAdmin(req, res);
            if (authError) return authError;

            const { status = 'pending', page = 1, limit = 50 } = req.query;
            const normalizedStatus = String(status).toLowerCase();
            if (!['pending', 'approved', 'rejected', 'all'].includes(normalizedStatus)) {
                return res.status(400).json({ success: false, message: 'status must be one of pending, approved, rejected, all.' });
            }

            const safePage = Math.max(1, Number(page) || 1);
            const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
            const offset = (safePage - 1) * safeLimit;

            const rows = await this.feedbackModel.getPaperSuggestions(normalizedStatus, safeLimit, offset);
            const suggestions = rows.map(this.normalizeSuggestionRow);

            return res.status(200).json({ success: true, count: suggestions.length, data: suggestions });
        } catch (err) {
            console.error('AdminController.getPaperSuggestions:', err);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    reviewPaperSuggestion = async (req, res) => {
        const client = await this.db.pool.connect();
        try {
            const authError = this.ensureAdmin(req, res);
            if (authError) return authError;

            const { id } = req.params;
            const { action, admin_note } = req.body;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'Suggestion id must be numeric.' });
            }

            const normalizedAction = String(action || '').toLowerCase();
            if (!['approve', 'reject'].includes(normalizedAction)) {
                return res.status(400).json({ success: false, message: 'action must be either approve or reject.' });
            }

            const existing = await this.feedbackModel.getPaperSuggestionById(Number(id));
            if (!existing) {
                return res.status(404).json({ success: false, message: 'Suggestion not found.' });
            }
            if (existing.response) {
                return res.status(409).json({ success: false, message: 'Suggestion has already been reviewed.' });
            }

            const suggestionPayload = this.parseSuggestionPayload(existing);
            if (!suggestionPayload?.title || !suggestionPayload?.publication_date || !suggestionPayload?.venue_id || !suggestionPayload?.topic_id) {
                return res.status(400).json({ success: false, message: 'Suggestion payload is invalid or incomplete.' });
            }

            if (!Array.isArray(suggestionPayload?.authors) || suggestionPayload.authors.length === 0) {
                return res.status(400).json({ success: false, message: 'Suggestion payload must include at least one author.' });
            }

            const normalizedAuthors = [];
            for (let index = 0; index < suggestionPayload.authors.length; index += 1) {
                const entry = suggestionPayload.authors[index];
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
                return res.status(400).json({ success: false, message: 'Invalid author data in suggestion payload.' });
            }

            const uniquePositions = new Set(normalizedAuthors.map((entry) => entry.position));
            if (uniquePositions.size !== normalizedAuthors.length) {
                return res.status(400).json({ success: false, message: 'Author positions must be unique.' });
            }

            await client.query('BEGIN');

            let createdPaper = null;
            let responseMarker = '';

            if (normalizedAction === 'approve') {
                const duplicatePapers = await this.paperModel.findDuplicateCandidates(
                    suggestionPayload.title,
                    suggestionPayload.doi || null,
                );
                if (duplicatePapers.length) {
                    await client.query('ROLLBACK');
                    return res.status(409).json({
                        success: false,
                        message: 'Cannot approve: similar paper already exists in the catalog.',
                        data: { duplicates: duplicatePapers },
                    });
                }

                const created = await client.query(
                    `INSERT INTO "paper"
                     (title, publication_date, pdf_url, doi, is_retracted, github_repo, venue_id)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                     RETURNING id, title, publication_date, doi, venue_id`,
                    [
                        suggestionPayload.title,
                        suggestionPayload.publication_date,
                        suggestionPayload.pdf_url || null,
                        suggestionPayload.doi || null,
                        Boolean(suggestionPayload.is_retracted),
                        suggestionPayload.github_repo || null,
                        Number(suggestionPayload.venue_id),
                    ],
                );
                createdPaper = created.rows[0];

                await client.query(
                    `INSERT INTO paper_topic (paper_id, topic_id)
                     VALUES ($1, $2)`,
                    [createdPaper.id, Number(suggestionPayload.topic_id)],
                );

                for (const author of normalizedAuthors) {
                    let authorId = author.author_id;

                    if (!authorId && author.orc_id) {
                        const existingAuthorResult = await client.query(
                            `SELECT id FROM author WHERE orc_id = $1 LIMIT 1`,
                            [author.orc_id],
                        );
                        authorId = existingAuthorResult.rows[0]?.id || null;
                    }

                    if (!authorId) {
                        const authorInsert = await client.query(
                            `INSERT INTO author (name, orc_id)
                             VALUES ($1, $2)
                             RETURNING id`,
                            [author.name, author.orc_id || null],
                        );
                        authorId = authorInsert.rows[0].id;
                    }

                    await client.query(
                        `INSERT INTO paper_author (paper_id, author_id, position)
                         VALUES ($1, $2, $3)`,
                        [createdPaper.id, Number(authorId), author.position],
                    );
                }

                responseMarker = `APPROVED::${createdPaper.id}::${(admin_note || '').trim()}`;
            } else {
                responseMarker = `REJECTED::${(admin_note || 'The suggestion was not approved.').trim()}`;
            }

            const updateResult = await client.query(
                `UPDATE feedback
                 SET response = $1, responded_at = now()
                 WHERE id = $2
                 RETURNING id, sender_id, response, responded_at`,
                [responseMarker, Number(id)],
            );

            await client.query('COMMIT');

            this.notificationModel
                .notifyFeedbackResponse(updateResult.rows[0].id, updateResult.rows[0].sender_id)
                .catch((error) => console.error('paper suggestion response notif error:', error));

            const fresh = await this.feedbackModel.getPaperSuggestionById(Number(id));
            return res.status(200).json({
                success: true,
                message: normalizedAction === 'approve' ? 'Suggestion approved and paper added.' : 'Suggestion rejected.',
                data: {
                    ...this.normalizeSuggestionRow(fresh),
                    created_paper: createdPaper,
                },
            });
        } catch (err) {
            try {
                await client.query('ROLLBACK');
            } catch (_rollbackError) {
                // Ignore rollback cleanup errors.
            }
            if (err.code === '23503') {
                return res.status(400).json({ success: false, message: 'Cannot approve: venue_id or topic_id does not exist.' });
            }
            if (err.code === '23505') {
                const conflictMessage = err.constraint === 'paper_doi_key'
                    ? 'Cannot approve: DOI already exists in paper catalog.'
                    : err.constraint === 'author_orc_id_key'
                        ? 'Cannot approve: an author with the same ORCID already exists.'
                        : 'Cannot approve: duplicate author-paper linkage conflict.';
                return res.status(409).json({ success: false, message: conflictMessage });
            }
            console.error('AdminController.reviewPaperSuggestion:', err);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        } finally {
            client.release();
        }
    }
}

module.exports = AdminController;
