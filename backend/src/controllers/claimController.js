const ClaimModel = require('../models/claimModel.js');

class ClaimController {
    constructor() {
        this.claimModel = new ClaimModel();
    }

    submitClaim = async (req, res) => {
        try {
            const { claimed_author_id, claim_text } = req.body;

            if (!claimed_author_id || !claim_text?.trim()) {
                return res.status(400).json({ error: 'claimed_author_id and claim_text are required.' });
            }

            if (isNaN(claimed_author_id)) {
                return res.status(400).json({ error: 'claimed_author_id must be a number.' });
            }

            const claim = await this.claimModel.submitClaim(
                req.user.id,
                Number(claimed_author_id),
                claim_text.trim()
            );

            return res.status(201).json({ success: true, data: claim });
        } catch (err) {
            if (err.code === 'NO_RESEARCHER_LINKED') return res.status(400).json({ error: err.message });
            if (err.code === 'ALREADY_RESEARCHER') return res.status(409).json({ error: err.message });
            if (err.code === '23503') return res.status(400).json({ error: 'Invalid author ID.' });
            console.error('ClaimController.submitClaim:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    };

    getPendingClaims = async (req, res) => {
        try {
            if (req.user?.role !== 'admin') {
                return res.status(403).json({ error: 'Only admins can access this resource.' });
            }

            const claims = await this.claimModel.getPendingClaims();
            return res.status(200).json({ success: true, count: claims.length, data: claims });
        } catch (err) {
            console.error('ClaimController.getPendingClaims:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    };

    approveClaim = async (req, res) => {
        try {
            if (req.user?.role !== 'admin') {
                return res.status(403).json({ error: 'Only admins can access this resource.' });
            }

            const { claimId } = req.params;
            if (isNaN(claimId)) return res.status(400).json({ error: 'claimId must be a number.' });

            const result = await this.claimModel.approveClaim(Number(claimId), req.user.id);
            return res.status(200).json({
                success: true,
                message: 'Claim approved. Researcher status transferred.',
                data: result,
            });
        } catch (err) {
            if (err.code === 'CLAIM_NOT_FOUND') return res.status(404).json({ error: err.message });
            console.error('ClaimController.approveClaim:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    };

    rejectClaim = async (req, res) => {
        try {
            if (req.user?.role !== 'admin') {
                return res.status(403).json({ error: 'Only admins can access this resource.' });
            }

            const { claimId } = req.params;
            if (isNaN(claimId)) return res.status(400).json({ error: 'claimId must be a number.' });

            const result = await this.claimModel.rejectClaim(Number(claimId), req.user.id);
            return res.status(200).json({
                success: true,
                message: 'Claim rejected. No changes made.',
                data: result,
            });
        } catch (err) {
            if (err.code === 'CLAIM_NOT_FOUND') return res.status(404).json({ error: err.message });
            console.error('ClaimController.rejectClaim:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    };
}

module.exports = ClaimController;
