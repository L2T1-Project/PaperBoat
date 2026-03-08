const PaperModel = require('../models/paperModel.js');

class PaperController {
    constructor(){
        this.paperModel = new PaperModel();
    }

    createPaper = async(req, res) => {
        try {
            const { title, publication_date, pdf_url, doi, is_retracted, github_repo, venue_id } = req.body;

            if (!title || !publication_date || !venue_id) {
                return res.status(400).json({
                    success: false,
                    message: 'title, publication_date and venue_id are required.'
                });
            }

            const paper = await this.paperModel.createPaper({
                title, publication_date, pdf_url, doi, is_retracted, github_repo, venue_id
            });

            return res.status(201).json({
                success: true,
                message: 'Paper created successfully.',
                data: paper
            });
        } catch (error) {
            if (error.code === '23505') {
                return res.status(409).json({
                    success: false,
                    message: 'A paper with that doi already exists.'
                });
            }
            if (error.code === '23503') {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid venue_id: referenced venue does not exist.'
                });
            }
            console.error('[createPaper]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    getAllPapers = async (req, res) => {
        try {
            const papers = await this.paperModel.getAllPapers();
            return res.status(200).json({ success: true, count: papers.length, data: papers });
        } catch (error) {
            console.error('[getAllPapers]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    getPaperById = async (req, res) => {
        try {
            const { id } = req.params;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }

            const paper = await this.paperModel.getPaperById(Number(id));

            if (!paper) {
                return res.status(404).json({ success: false, message: `Paper with id ${id} not found.` });
            }

            return res.status(200).json({ success: true, data: paper });
        } catch (error) {
            console.error('[getPaperById]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    updatePaper = async (req, res) => {
        try {
            const { id } = req.params;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }

            const { title, publication_date, pdf_url, doi, is_retracted, github_repo, venue_id } = req.body;

            if (!title || !publication_date || !venue_id) {
                return res.status(400).json({
                    success: false,
                    message: 'title, publication_date and venue_id are required.'
                });
            }

            const paper = await this.paperModel.updatePaper(Number(id), {
                title, publication_date, pdf_url, doi, is_retracted, github_repo, venue_id
            });

            if (!paper) {
                return res.status(404).json({ success: false, message: `Paper with id ${id} not found.` });
            }

            return res.status(200).json({ success: true, message: 'Paper updated successfully.', data: paper });
        } catch (error) {
            if (error.code === '23505') {
                return res.status(409).json({ success: false, message: 'A paper with that doi already exists.' });
            }
            if (error.code === '23503') {
                return res.status(400).json({ success: false, message: 'Invalid venue_id: referenced venue does not exist.' });
            }
            console.error('[updatePaper]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    deletePaper = async (req, res) => {
        try {
            const { id } = req.params;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }

            const paper = await this.paperModel.deletePaper(Number(id));

            if (!paper) {
                return res.status(404).json({ success: false, message: `Paper with id ${id} not found.` });
            }

            return res.status(200).json({ success: true, message: 'Paper deleted successfully.', data: paper });
        } catch (error) {
            console.error('[deletePaper]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }


    getCitedBy = async (req, res) => {
        try {
            const { id } = req.params;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }

            const papers = await this.paperModel.getCitedBy(Number(id));
            return res.status(200).json({ success: true, count: papers.length, data: papers });
        } catch (error) {
            console.error('[getCitedBy]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    getReferences = async (req, res) => {
        try {
            const { id } = req.params;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }

            const papers = await this.paperModel.getReferences(Number(id));
            return res.status(200).json({ success: true, count: papers.length, data: papers });
        } catch (error) {
            console.error('[getReferences]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    addCitation = async (req, res) => {
        try {
            const { id } = req.params;     // citing paper
            const { cited_id } = req.body;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }
            if (!cited_id || isNaN(cited_id)) {
                return res.status(400).json({ success: false, message: 'cited_id is required and must be a number.' });
            }
            if (Number(id) === Number(cited_id)) {
                return res.status(400).json({ success: false, message: 'A paper cannot cite itself.' });
            }

            const citation = await this.paperModel.addCitation(Number(id), Number(cited_id));
            return res.status(201).json({ success: true, message: 'Citation added.', data: citation });
        } catch (error) {
            if (error.code === '23505') {
                return res.status(409).json({ success: false, message: 'This citation already exists.' });
            }
            if (error.code === '23503') {
                return res.status(404).json({ success: false, message: 'Citing or cited paper not found.' });
            }
            console.error('[addCitation]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    removeCitation = async (req, res) => {
        try {
            const { id, citedId } = req.params;

            if (isNaN(id) || isNaN(citedId)) {
                return res.status(400).json({ success: false, message: 'id and citedId must be numbers.' });
            }

            const citation = await this.paperModel.removeCitation(Number(id), Number(citedId));

            if (!citation) {
                return res.status(404).json({ success: false, message: 'Citation not found.' });
            }

            return res.status(200).json({ success: true, message: 'Citation removed.', data: citation });
        } catch (error) {
            console.error('[removeCitation]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    //I have to change the name of the paper_topic functions

    getPaperTopics = async (req, res) => {
        try {
            const { id } = req.params;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }

            const topics = await this.paperModel.getPaperTopics(Number(id));
            return res.status(200).json({ success: true, count: topics.length, data: topics });
        } catch (error) {
            console.error('[getTopics]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    addPaperTopic = async (req, res) => {
        try {
            const { id } = req.params;     // paper id
            const { topic_id } = req.body;

            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }
            if (!topic_id || isNaN(topic_id)) {
                return res.status(400).json({ success: false, message: 'topic_id is required and must be a number.' });
            }

            const entry = await this.paperModel.addPaperTopic(Number(id), Number(topic_id));
            return res.status(201).json({ success: true, message: 'Topic added to paper.', data: entry });
        } catch (error) {
            if (error.code === '23505') {
                return res.status(409).json({ success: false, message: 'This topic is already linked to the paper.' });
            }
            if (error.code === '23503') {
                return res.status(404).json({ success: false, message: 'Paper or topic not found.' });
            }
            console.error('[addTopic]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    removePaperTopic = async (req, res) => {
        try {
            const { id, topicId } = req.params;

            if (isNaN(id) || isNaN(topicId)) {
                return res.status(400).json({ success: false, message: 'id and topicId must be numbers.' });
            }

            const entry = await this.paperModel.removePaperTopic(Number(id), Number(topicId));

            if (!entry) {
                return res.status(404).json({ success: false, message: 'Topic not linked to this paper.' });
            }

            return res.status(200).json({ success: true, message: 'Topic removed from paper.', data: entry });
        } catch (error) {
            console.error('[removeTopic]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }
}

module.exports = PaperController;