const InstituteModel = require('../models/instituteModel.js');

class InstituteController {
    constructor() {
        this.instituteModel = new InstituteModel();
    }


    createInstitute = async (req, res) => {
        try {
            const { name, country, website_url, img_url } = req.body;

            if (!name) {
                return res.status(400).json({ success: false, message: 'name is required.' });
            }

            const institute = await this.instituteModel.createInstitute({
                name, country, website_url, img_url
            });

            return res.status(201).json({
                success: true,
                message: 'Institute created successfully.',
                data: institute
            });
        } catch (error) {
            console.error('[createInstitute]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    getAllInstitutes = async (req, res) => {
        try {
            const institutes = await this.instituteModel.getAllInstitutes();
            return res.status(200).json({ success: true, count: institutes.length, data: institutes });
        } catch (error) {
            console.error('[getAllInstitutes]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    getInstituteById = async (req, res) => {
        try {
            const { id } = req.params;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }

            const institute = await this.instituteModel.getInstituteById(Number(id));

            if (!institute) {
                return res.status(404).json({
                    success: false,
                    message: `Institute with id ${id} not found.`
                });
            }

            return res.status(200).json({ success: true, data: institute });
        } catch (error) {
            console.error('[getInstituteById]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    updateInstitute = async (req, res) => {
        try {
            const { id } = req.params;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }

            const { name, country, website_url, img_url } = req.body;

            if (!name) {
                return res.status(400).json({ success: false, message: 'name is required.' });
            }

            const institute = await this.instituteModel.updateInstitute(Number(id), {
                name, country, website_url, img_url
            });

            if (!institute) {
                return res.status(404).json({
                    success: false,
                    message: `Institute with id ${id} not found.`
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Institute updated successfully.',
                data: institute
            });
        } catch (error) {
            console.error('[updateInstitute]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    deleteInstitute = async (req, res) => {
        try {
            const { id } = req.params;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }

            const institute = await this.instituteModel.deleteInstitute(Number(id));

            if (!institute) {
                return res.status(404).json({
                    success: false,
                    message: `Institute with id ${id} not found.`
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Institute deleted successfully.',
                data: institute
            });
        } catch (error) {
            console.error('[deleteInstitute]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    getResearchersByInstitute = async (req, res) => {
        try {
            const { id } = req.params;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }

            const researchers = await this.instituteModel.getResearchersByInstitute(Number(id));
            return res.status(200).json({ success: true, count: researchers.length, data: researchers });
        } catch (error) {
            console.error('[getResearchersByInstitute]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }
}

module.exports = InstituteController;
