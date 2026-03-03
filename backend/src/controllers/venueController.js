const VenueModel = require('../models/venueModel.js');

class VenueController {
    constructor() {
        this.venueModel = new VenueModel();
    }


    createPublisher = async (req, res) => {
        try {
            const { name, country, website } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'name is required' });
            }

            const publisher = await this.venueModel.createPublisher(name, country, website);
            return res.status(201).json(publisher);
        } catch (err) {
            if (err.code === '23505') return res.status(409).json({ error: 'Publisher already exists' });
            console.error('VenueController.createPublisher:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getAllPublishers = async (req, res) => {
        try {
            const publishers = await this.venueModel.getAllPublishers();
            return res.status(200).json(publishers);
        } catch (err) {
            console.error('VenueController.getAllPublishers:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getPublisherById = async (req, res) => {
        try {
            const { id } = req.params;
            const publisher = await this.venueModel.getPublisherById(id);

            if (!publisher) return res.status(404).json({ error: 'Publisher not found' });
            return res.status(200).json(publisher);
        } catch (err) {
            console.error('VenueController.getPublisherById:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    updatePublisher = async (req, res) => {
        try {
            const { id } = req.params;
            const { name, country, website } = req.body;

            const publisher = await this.venueModel.updatePublisher(id, name, country, website);
            if (!publisher) return res.status(404).json({ error: 'Publisher not found' });
            return res.status(200).json(publisher);
        } catch (err) {
            console.error('VenueController.updatePublisher:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    deletePublisher = async (req, res) => {
        try {
            const { id } = req.params;
            const removed = await this.venueModel.deletePublisher(id);

            if (!removed) return res.status(404).json({ error: 'Publisher not found' });
            return res.status(200).json({ message: 'Publisher deleted', id: removed.id });
        } catch (err) {
            if (err.code === '23503') return res.status(400).json({ error: 'Cannot delete publisher: venues are referencing it' });
            console.error('VenueController.deletePublisher:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }


    createVenue = async (req, res) => {
        try {
            const { name, type, issn, publisher_id } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'name is required' });
            }

            const venue = await this.venueModel.createVenue(name, type, issn, publisher_id);
            return res.status(201).json(venue);
        } catch (err) {
            if (err.code === '23505') return res.status(409).json({ error: 'Venue with this ISSN already exists' });
            if (err.code === '23503') return res.status(400).json({ error: 'Publisher not found' });
            if (err.code === '23514') return res.status(400).json({ error: 'Invalid venue type' });
            console.error('VenueController.createVenue:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getAllVenues = async (req, res) => {
        try {
            const venues = await this.venueModel.getAllVenues();
            return res.status(200).json(venues);
        } catch (err) {
            console.error('VenueController.getAllVenues:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getVenueById = async (req, res) => {
        try {
            const { id } = req.params;
            const venue = await this.venueModel.getVenueById(id);

            if (!venue) return res.status(404).json({ error: 'Venue not found' });
            return res.status(200).json(venue);
        } catch (err) {
            console.error('VenueController.getVenueById:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    updateVenue = async (req, res) => {
        try {
            const { id } = req.params;
            const { name, type, issn, publisher_id } = req.body;

            const venue = await this.venueModel.updateVenue(id, name, type, issn, publisher_id);
            if (!venue) return res.status(404).json({ error: 'Venue not found' });
            return res.status(200).json(venue);
        } catch (err) {
            if (err.code === '23505') return res.status(409).json({ error: 'ISSN already in use by another venue' });
            if (err.code === '23503') return res.status(400).json({ error: 'Publisher not found' });
            if (err.code === '23514') return res.status(400).json({ error: 'Invalid venue type' });
            console.error('VenueController.updateVenue:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    deleteVenue = async (req, res) => {
        try {
            const { id } = req.params;
            const removed = await this.venueModel.deleteVenue(id);

            if (!removed) return res.status(404).json({ error: 'Venue not found' });
            return res.status(200).json({ message: 'Venue deleted', id: removed.id });
        } catch (err) {
            if (err.code === '23503') return res.status(400).json({ error: 'Cannot delete venue: records are referencing it' });
            console.error('VenueController.deleteVenue:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }


    lookupByIssn = async (req, res) => {
        try {
            const { issn } = req.query;

            if (!issn) return res.status(400).json({ error: 'issn query param is required' });

            const venue = await this.venueModel.getVenueByIssn(issn);
            if (!venue) return res.status(404).json({ error: 'No venue found with that ISSN' });
            return res.status(200).json(venue);
        } catch (err) {
            console.error('VenueController.lookupByIssn:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    lookupByName = async (req, res) => {
        try {
            const { venue_name, publisher_name } = req.query;

            if (!venue_name) return res.status(400).json({ error: 'venue_name query param is required' });

            const venues = await this.venueModel.getVenuesByNameAndPublisher(venue_name, publisher_name);
            return res.status(200).json(venues);
        } catch (err) {
            console.error('VenueController.lookupByName:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = VenueController;
