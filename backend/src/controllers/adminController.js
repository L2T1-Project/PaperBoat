const AdminModel = require('../models/adminModel.js');

class AdminController {
    constructor() {
        this.adminModel = new AdminModel();
    }

    promoteUser = async (req, res) => {
        try {
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
            const admins = await this.adminModel.getAllAdmins();
            return res.status(200).json(admins);
        } catch (err) {
            console.error('AdminController.getAllAdmins:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getAdminById = async (req, res) => {
        try {
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
            const claims = await this.adminModel.getAllPaperClaims();
            return res.status(200).json({ success: true, count: claims.length, data: claims });
        } catch (err) {
            console.error('AdminController.getAllClaims:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getPaperClaimsByStatus = async (req, res) => {
        try {
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
            const { researcherId, paperId } = req.params;
            const { status_id } = req.body;

            if (isNaN(researcherId) || isNaN(paperId)) {
                return res.status(400).json({ error: 'researcherId and paperId must be numbers.' });
            }
            if (!status_id || isNaN(status_id)) {
                return res.status(400).json({ error: 'status_id is required and must be a number.' });
            }

            const claim = await this.adminModel.updatePaperClaimStatus(
                Number(researcherId),
                Number(paperId),
                Number(status_id)
            );

            if (!claim) return res.status(404).json({ error: 'Paper claim not found.' });
            return res.status(200).json({ success: true, message: 'Claim status updated.', data: claim });
        } catch (err) {
            if (err.code === '23503') return res.status(400).json({ error: 'status_id does not exist in the status table.' });
            console.error('AdminController.updateClaimStatus:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = AdminController;
