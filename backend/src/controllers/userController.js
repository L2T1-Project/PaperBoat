const UserModel = require('../models/userModel.js');

class UserController {
    constructor() {
        this.userModel = new UserModel();
    }

    createUser = async (req, res) => {
        try {
            const { username, full_name, email, password_hash, phone_number, status_id, bio } = req.body;

            if (!username || !full_name || !email || !password_hash || !status_id) {
                return res.status(400).json({
                    success: false,
                    message: 'username, full_name, email, password_hash, and status_id are required.'
                });
            }

            const user = await this.userModel.createUser({
                username, full_name, email, password_hash, phone_number, status_id, bio
            });

            return res.status(201).json({
                success: true,
                message: 'User created successfully.',
                data: user
            });
        } catch (error) {
            // PostgreSQL unique violation error code
            if (error.code === '23505') {
                return res.status(409).json({
                    success: false,
                    message: 'A user with that email or username already exists.'
                });
            }
            // FK violation (e.g. invalid status_id)
            if (error.code === '23503') {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status_id: referenced status does not exist.'
                });
            }
            console.error('[createUser]', error.message);
            return res.status(500).json({
                success: false,
                message: 'Internal server error.'
            });
        }
    }

    getAllUsers = async (req, res) => {
        try {
            const users = await this.userModel.getAllUsers();
            return res.status(200).json({
                success: true,
                count: users.length,
                data: users
            });
        } catch (error) {
            console.error('[getAllUsers]', error.message);
            return res.status(500).json({
                success: false,
                message: 'Internal server error.'
            });
        }
    }

    getUserById = async (req, res) => {
        try {
            const { id } = req.params;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }

            const user = await this.userModel.getUserById(Number(id));

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: `User with id ${id} not found.`
                });
            }

            return res.status(200).json({ success: true, data: user });
        } catch (error) {
            console.error('[getUserById]', error.message);
            return res.status(500).json({
                success: false,
                message: 'Internal server error.'
            });
        }
    }

    updateUser = async (req, res) => {
        try {
            const { id } = req.params;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }

            const { username, full_name, email, phone_number, profile_pic_url, bio } = req.body;

            if (!username || !full_name || !email) {
                return res.status(400).json({
                    success: false,
                    message: 'username, full_name, and email are required.'
                });
            }

            const user = await this.userModel.updateUser(Number(id), {
                username, full_name, email, phone_number, profile_pic_url, bio
            });

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: `User with id ${id} not found.`
                });
            }

            return res.status(200).json({
                success: true,
                message: 'User updated successfully.',
                data: user
            });
        } catch (error) {
            if (error.code === '23505') {
                return res.status(409).json({
                    success: false,
                    message: 'A user with that email or username already exists.'
                });
            }
            console.error('[updateUser]', error.message);
            return res.status(500).json({
                success: false,
                message: 'Internal server error.'
            });
        }
    }

    deleteUser = async (req, res) => {
        try {
            const { id } = req.params;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }

            const user = await this.userModel.deleteUser(Number(id));

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: `User with id ${id} not found.`
                });
            }

            return res.status(200).json({
                success: true,
                message: 'User deleted successfully.',
                data: user
            });
        } catch (error) {
            console.error('[deleteUser]', error.message);
            return res.status(500).json({
                success: false,
                message: 'Internal server error.'
            });
        }
    }
}

module.exports = UserController;


//random thing
//random cmnt