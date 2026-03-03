const ResearcherModel = require('../models/researcherModel.js');

class ResearcherController {
    constructor() {
        this.researcherModel = new ResearcherModel();
    }


    createResearcher = async (req, res) => {
        try {
            const { user_id, author_id } = req.body;

            if (!user_id || isNaN(user_id)) {
                return res.status(400).json({ success: false, message: 'user_id is required and must be a number.' });
            }
            if (!author_id || isNaN(author_id)) {
                return res.status(400).json({ success: false, message: 'author_id is required and must be a number.' });
            }

            const researcher = await this.researcherModel.createResearcher(
                Number(user_id),
                Number(author_id)
            );

            return res.status(201).json({
                success: true,
                message: 'Researcher created successfully.',
                data: researcher
            });
        } catch (error) {
            if (error.code === '23505') {
                return res.status(409).json({
                    success: false,
                    message: 'This user is already a researcher, or that author is already claimed by another user.'
                });
            }
            if (error.code === '23503') {
                return res.status(404).json({
                    success: false,
                    message: 'User or author not found.'
                });
            }
            console.error('[createResearcher]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    getAllResearchers = async (req, res) => {
        try {
            const researchers = await this.researcherModel.getAllResearchers();
            return res.status(200).json({ success: true, count: researchers.length, data: researchers });
        } catch (error) {
            console.error('[getAllResearchers]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    getResearcherById = async (req, res) => {
        try {
            const { id } = req.params;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }

            const researcher = await this.researcherModel.getResearcherById(Number(id));

            if (!researcher) {
                return res.status(404).json({
                    success: false,
                    message: `Researcher with user_id ${id} not found.`
                });
            }

            return res.status(200).json({ success: true, data: researcher });
        } catch (error) {
            console.error('[getResearcherById]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    deleteResearcher = async (req, res) => {
        try {
            const { id } = req.params;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }

            const researcher = await this.researcherModel.deleteResearcher(Number(id));

            if (!researcher) {
                return res.status(404).json({
                    success: false,
                    message: `Researcher with user_id ${id} not found.`
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Researcher deleted successfully.',
                data: researcher
            });
        } catch (error) {
            console.error('[deleteResearcher]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    // ── PAPER_CLAIM ────────────────────────────────────────────────────────────

    createClaim = async (req, res) => {
        try {
            const { id } = req.params;      // researcher user_id
            const { paper_id, position } = req.body;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }
            if (!paper_id || isNaN(paper_id)) {
                return res.status(400).json({ success: false, message: 'paper_id is required and must be a number.' });
            }
            if (!position || isNaN(position) || Number(position) < 1) {
                return res.status(400).json({ success: false, message: 'position is required and must be a positive integer.' });
            }

            const claim = await this.researcherModel.createClaim(Number(id), Number(paper_id), Number(position));

            return res.status(201).json({
                success: true,
                message: 'Paper claim submitted.',
                data: claim
            });
        } catch (error) {
            if (error.code === '23505') {
                return res.status(409).json({ success: false, message: 'This researcher has already claimed this paper.' });
            }
            if (error.code === '23503') {
                return res.status(404).json({ success: false, message: 'Researcher or paper not found.' });
            }
            console.error('[createClaim]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    getClaimsByResearcher = async (req, res) => {
        try {
            const { id } = req.params;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }

            const claims = await this.researcherModel.getClaimsByResearcher(Number(id));
            return res.status(200).json({ success: true, count: claims.length, data: claims });
        } catch (error) {
            console.error('[getClaimsByResearcher]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    deleteClaim = async (req, res) => {
        try {
            const { id, paperId } = req.params;

            if (isNaN(id) || isNaN(paperId)) {
                return res.status(400).json({ success: false, message: 'id and paperId must be numbers.' });
            }

            const claim = await this.researcherModel.deleteClaim(Number(id), Number(paperId));

            if (!claim) {
                return res.status(404).json({ success: false, message: 'Claim not found.' });
            }

            return res.status(200).json({ success: true, message: 'Claim retracted.', data: claim });
        } catch (error) {
            console.error('[deleteClaim]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    // ── INSTITUTE_HISTORY ──────────────────────────────────────────────────────

    addInstituteHistory = async (req, res) => {
        try {
            const { id } = req.params;      // researcher user_id
            const { institute_id, from_date, upto_date } = req.body;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }
            if (!institute_id || isNaN(institute_id)) {
                return res.status(400).json({ success: false, message: 'institute_id is required and must be a number.' });
            }
            if (!from_date) {
                return res.status(400).json({ success: false, message: 'from_date is required.' });
            }

            const entry = await this.researcherModel.addInstituteHistory(
                Number(id), Number(institute_id), from_date, upto_date || null
            );

            return res.status(201).json({
                success: true,
                message: 'Institute affiliation added.',
                data: entry
            });
        } catch (error) {
            if (error.code === '23505') {
                return res.status(409).json({ success: false, message: 'This affiliation record already exists.' });
            }
            if (error.code === '23503') {
                return res.status(404).json({ success: false, message: 'Researcher or institute not found.' });
            }
            if (error.code === '23514') {
                return res.status(400).json({ success: false, message: 'upto_date must be on or after from_date.' });
            }
            console.error('[addInstituteHistory]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    getInstituteHistory = async (req, res) => {
        try {
            const { id } = req.params;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }

            const history = await this.researcherModel.getInstituteHistory(Number(id));
            return res.status(200).json({ success: true, count: history.length, data: history });
        } catch (error) {
            console.error('[getInstituteHistory]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    updateInstituteHistory = async (req, res) => {
        try {
            const { id, instituteId } = req.params;
            const { from_date, upto_date } = req.body;

            if (isNaN(id) || isNaN(instituteId)) {
                return res.status(400).json({ success: false, message: 'id and instituteId must be numbers.' });
            }
            if (!from_date) {
                return res.status(400).json({ success: false, message: 'from_date is required to identify the record.' });
            }
            if (!upto_date) {
                return res.status(400).json({ success: false, message: 'upto_date is required.' });
            }

            const entry = await this.researcherModel.updateInstituteHistory(
                Number(id), Number(instituteId), from_date, upto_date
            );

            if (!entry) {
                return res.status(404).json({ success: false, message: 'Affiliation record not found.' });
            }

            return res.status(200).json({
                success: true,
                message: 'Affiliation updated.',
                data: entry
            });
        } catch (error) {
            if (error.code === '23514') {
                return res.status(400).json({ success: false, message: 'upto_date must be on or after from_date.' });
            }
            console.error('[updateInstituteHistory]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    removeInstituteHistory = async (req, res) => {
        try {
            const { id, instituteId } = req.params;
            const { from_date } = req.body;

            if (isNaN(id) || isNaN(instituteId)) {
                return res.status(400).json({ success: false, message: 'id and instituteId must be numbers.' });
            }
            if (!from_date) {
                return res.status(400).json({ success: false, message: 'from_date is required to identify the record.' });
            }

            const entry = await this.researcherModel.removeInstituteHistory(
                Number(id), Number(instituteId), from_date
            );

            if (!entry) {
                return res.status(404).json({ success: false, message: 'Affiliation record not found.' });
            }

            return res.status(200).json({ success: true, message: 'Affiliation removed.', data: entry });
        } catch (error) {
            console.error('[removeInstituteHistory]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }
}

module.exports = ResearcherController;
