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


    followUser = async (req, res) => {
        try {
            const { id } = req.params;         
            const { followingUserId } = req.body;

            if (isNaN(id) || !followingUserId || isNaN(followingUserId)) {
                return res.status(400).json({ success: false, message: 'id (param) and followingUserId (body) must be numbers.' });
            }

            if (Number(id) === Number(followingUserId)) {
                return res.status(400).json({ success: false, message: 'A user cannot follow themselves.' });
            }

            const follow = await this.userModel.followUser(Number(followingUserId), Number(id));

            return res.status(201).json({ success: true, message: 'Followed successfully.', data: follow });
        } catch (error) {
            if (error.code === '23505') {
                return res.status(409).json({ success: false, message: 'Already following this user.' });
            }
            if (error.code === '23503') {
                return res.status(404).json({ success: false, message: 'User not found.' });
            }
            console.error('[followUser]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    unfollowUser = async (req, res) => {
        try {
            const { id } = req.params;          
            const { followingUserId } = req.body;

            if (isNaN(id) || !followingUserId || isNaN(followingUserId)) {
                return res.status(400).json({ success: false, message: 'id (param) and followingUserId (body) must be numbers.' });
            }

            const follow = await this.userModel.unfollowUser(Number(followingUserId), Number(id));

            if (!follow) {
                return res.status(404).json({ success: false, message: 'Follow relationship not found.' });
            }

            return res.status(200).json({ success: true, message: 'Unfollowed successfully.', data: follow });
        } catch (error) {
            console.error('[unfollowUser]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    getFollowers = async (req, res) => {
        try {
            const { id } = req.params;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }

            const followers = await this.userModel.getFollowers(Number(id));
            return res.status(200).json({ success: true, count: followers.length, data: followers });
        } catch (error) {
            console.error('[getFollowers]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    getFollowing = async (req, res) => {
        try {
            const { id } = req.params;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }

            const following = await this.userModel.getFollowing(Number(id));
            return res.status(200).json({ success: true, count: following.length, data: following });
        } catch (error) {
            console.error('[getFollowing]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }


    getAllStatuses = async (req, res) => {
        try {
            const statuses = await this.userModel.getAllStatuses();
            return res.status(200).json({ success: true, data: statuses });
        } catch (error) {
            console.error('[getAllStatuses]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }


    addToUserLibrary = async (req, res) => {
        try {
            const { id } = req.params;     
            const { paper_id } = req.body;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }
            if (!paper_id || isNaN(paper_id)) {
                return res.status(400).json({ success: false, message: 'paper_id is required and must be a number.' });
            }

            const entry = await this.userModel.addToUserLibrary(Number(id), Number(paper_id));
            return res.status(201).json({ success: true, message: 'Paper added to library.', data: entry });
        } catch (error) {
            if (error.code === '23505') {
                return res.status(409).json({ success: false, message: 'Paper is already in this user\'s library.' });
            }
            if (error.code === '23503') {
                return res.status(404).json({ success: false, message: 'User or paper not found.' });
            }
            console.error('[addToLibrary]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    removeFromUserLibrary = async (req, res) => {
        try {
            const { id, paperId } = req.params;

            if (isNaN(id) || isNaN(paperId)) {
                return res.status(400).json({ success: false, message: 'id and paperId must be numbers.' });
            }

            const entry = await this.userModel.removeFromUserLibrary(Number(id), Number(paperId));

            if (!entry) {
                return res.status(404).json({ success: false, message: 'Paper not found in library.' });
            }

            return res.status(200).json({ success: true, message: 'Paper removed from library.', data: entry });
        } catch (error) {
            console.error('[removeFromLibrary]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    getUserLibrary = async (req, res) => {
        try {
            const { id } = req.params;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }

            const library = await this.userModel.getUserLibrary(Number(id));
            return res.status(200).json({ success: true, count: library.length, data: library });
        } catch (error) {
            console.error('[getUserLibrary]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }
}

module.exports = UserController;