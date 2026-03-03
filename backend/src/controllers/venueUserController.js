const VenueUserModel = require('../models/venueUserModel.js');

class VenueUserController {
    constructor() {
        this.venueUserModel = new VenueUserModel();
    }

    createVenueUser = async (req, res) => {
        try {
            const { user_id, venue_id } = req.body;

            if (!user_id || !venue_id) {
                return res.status(400).json({ error: 'user_id and venue_id are required' });
            }

            const venueUser = await this.venueUserModel.createVenueUser(user_id, venue_id);
            return res.status(201).json(venueUser);
        } catch (err) {
            if (err.code === '23505') return res.status(409).json({ error: 'User is already registered as a venue user' });
            if (err.code === '23503') return res.status(400).json({ error: 'User or venue not found' });
            console.error('VenueUserController.createVenueUser:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getAllVenueUsers = async (req, res) => {
        try {
            const venueUsers = await this.venueUserModel.getAllVenueUsers();
            return res.status(200).json(venueUsers);
        } catch (err) {
            console.error('VenueUserController.getAllVenueUsers:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getVenueUserById = async (req, res) => {
        try {
            const { id } = req.params;
            const venueUser = await this.venueUserModel.getVenueUserById(id);

            if (!venueUser) return res.status(404).json({ error: 'Venue user not found' });
            return res.status(200).json(venueUser);
        } catch (err) {
            console.error('VenueUserController.getVenueUserById:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    deleteVenueUser = async (req, res) => {
        try {
            const { id } = req.params;
            const removed = await this.venueUserModel.deleteVenueUser(id);

            if (!removed) return res.status(404).json({ error: 'Venue user not found' });
            return res.status(200).json({ message: 'Venue user removed successfully', user_id: removed.user_id });
        } catch (err) {
            console.error('VenueUserController.deleteVenueUser:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = VenueUserController;
