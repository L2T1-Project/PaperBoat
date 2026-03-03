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
}

module.exports = AdminController;
