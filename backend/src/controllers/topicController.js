const TopicModel = require('../models/topicModel.js');

class TopicController {
    constructor() {
        this.topicModel = new TopicModel();
    }

    createDomain = async (req, res) => {
        try {
            const { name } = req.body;
            if (!name) return res.status(400).json({ error: 'name is required' });
            const domain = await this.topicModel.createDomain(name);
            return res.status(201).json(domain);
        } catch (err) {
            if (err.code === '23505') return res.status(409).json({ error: 'Domain already exists' });
            console.error('TopicController.createDomain:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getAllDomains = async (req, res) => {
        try {
            const domains = await this.topicModel.getAllDomains();
            return res.status(200).json(domains);
        } catch (err) {
            console.error('TopicController.getAllDomains:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getDomainById = async (req, res) => {
        try {
            const { id } = req.params;
            const domain = await this.topicModel.getDomainById(id);
            if (!domain) return res.status(404).json({ error: 'Domain not found' });
            return res.status(200).json(domain);
        } catch (err) {
            console.error('TopicController.getDomainById:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    updateDomain = async (req, res) => {
        try {
            const { id } = req.params;
            const { name } = req.body;
            const domain = await this.topicModel.updateDomain(id, name);
            if (!domain) return res.status(404).json({ error: 'Domain not found' });
            return res.status(200).json(domain);
        } catch (err) {
            if (err.code === '23505') return res.status(409).json({ error: 'Domain name already exists' });
            console.error('TopicController.updateDomain:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    deleteDomain = async (req, res) => {
        try {
            const { id } = req.params;
            const removed = await this.topicModel.deleteDomain(id);
            if (!removed) return res.status(404).json({ error: 'Domain not found' });
            return res.status(200).json({ message: 'Domain deleted', id: removed.id });
        } catch (err) {
            if (err.code === '23503') return res.status(400).json({ error: 'Cannot delete domain: fields are referencing it' });
            console.error('TopicController.deleteDomain:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    createField = async (req, res) => {
        try {
            const { domain_id, name } = req.body;
            if (!domain_id || !name) return res.status(400).json({ error: 'domain_id and name are required' });
            const field = await this.topicModel.createField(domain_id, name);
            return res.status(201).json(field);
        } catch (err) {
            if (err.code === '23505') return res.status(409).json({ error: 'Field already exists in this domain' });
            if (err.code === '23503') return res.status(400).json({ error: 'Domain not found' });
            console.error('TopicController.createField:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getAllFields = async (req, res) => {
        try {
            const fields = await this.topicModel.getAllFields();
            return res.status(200).json(fields);
        } catch (err) {
            console.error('TopicController.getAllFields:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getFieldById = async (req, res) => {
        try {
            const { id } = req.params;
            const field = await this.topicModel.getFieldById(id);
            if (!field) return res.status(404).json({ error: 'Field not found' });
            return res.status(200).json(field);
        } catch (err) {
            console.error('TopicController.getFieldById:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getFieldsByDomain = async (req, res) => {
        try {
            const { id } = req.params;
            const fields = await this.topicModel.getFieldsByDomain(id);
            return res.status(200).json(fields);
        } catch (err) {
            console.error('TopicController.getFieldsByDomain:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    updateField = async (req, res) => {
        try {
            const { id } = req.params;
            const { domain_id, name } = req.body;
            const field = await this.topicModel.updateField(id, domain_id, name);
            if (!field) return res.status(404).json({ error: 'Field not found' });
            return res.status(200).json(field);
        } catch (err) {
            if (err.code === '23505') return res.status(409).json({ error: 'Field name already exists in this domain' });
            if (err.code === '23503') return res.status(400).json({ error: 'Domain not found' });
            console.error('TopicController.updateField:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    deleteField = async (req, res) => {
        try {
            const { id } = req.params;
            const removed = await this.topicModel.deleteField(id);
            if (!removed) return res.status(404).json({ error: 'Field not found' });
            return res.status(200).json({ message: 'Field deleted', id: removed.id });
        } catch (err) {
            if (err.code === '23503') return res.status(400).json({ error: 'Cannot delete field: topics are referencing it' });
            console.error('TopicController.deleteField:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    createTopic = async (req, res) => {
        try {
            const { field_id, name } = req.body;
            if (!field_id || !name) return res.status(400).json({ error: 'field_id and name are required' });
            const topic = await this.topicModel.createTopic(field_id, name);
            return res.status(201).json(topic);
        } catch (err) {
            if (err.code === '23505') return res.status(409).json({ error: 'Topic already exists in this field' });
            if (err.code === '23503') return res.status(400).json({ error: 'Field not found' });
            console.error('TopicController.createTopic:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getAllTopics = async (req, res) => {
        try {
            const topics = await this.topicModel.getAllTopics();
            return res.status(200).json(topics);
        } catch (err) {
            console.error('TopicController.getAllTopics:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getTopicById = async (req, res) => {
        try {
            const { id } = req.params;
            const topic = await this.topicModel.getTopicById(id);
            if (!topic) return res.status(404).json({ error: 'Topic not found' });
            return res.status(200).json(topic);
        } catch (err) {
            console.error('TopicController.getTopicById:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getTopicsByField = async (req, res) => {
        try {
            const { id } = req.params;
            const topics = await this.topicModel.getTopicsByField(id);
            return res.status(200).json(topics);
        } catch (err) {
            console.error('TopicController.getTopicsByField:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    updateTopic = async (req, res) => {
        try {
            const { id } = req.params;
            const { field_id, name } = req.body;
            const topic = await this.topicModel.updateTopic(id, field_id, name);
            if (!topic) return res.status(404).json({ error: 'Topic not found' });
            return res.status(200).json(topic);
        } catch (err) {
            if (err.code === '23505') return res.status(409).json({ error: 'Topic name already exists in this field' });
            if (err.code === '23503') return res.status(400).json({ error: 'Field not found' });
            console.error('TopicController.updateTopic:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    deleteTopic = async (req, res) => {
        try {
            const { id } = req.params;
            const removed = await this.topicModel.deleteTopic(id);
            if (!removed) return res.status(404).json({ error: 'Topic not found' });
            return res.status(200).json({ message: 'Topic deleted', id: removed.id });
        } catch (err) {
            if (err.code === '23503') return res.status(400).json({ error: 'Cannot delete topic: papers are referencing it' });
            console.error('TopicController.deleteTopic:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getSummaryStats = async (req, res) => {
        try {
            const summary = await this.topicModel.getPlatformSummaryStats();
            return res.status(200).json({ success: true, data: summary });
        } catch (err) {
            console.error('TopicController.getSummaryStats:', err);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }

    getTopicMomentum = async (req, res) => {
        try {
            const { limit = 10, windowDays = 90 } = req.query;

            const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
            const safeWindowDays = Math.min(365, Math.max(30, Number(windowDays) || 90));

            const rows = await this.topicModel.getTopicMomentum(safeLimit, safeWindowDays);
            return res.status(200).json({
                success: true,
                data: rows,
                meta: {
                    limit: safeLimit,
                    window_days: safeWindowDays,
                    formula: '0.7 * citation_growth_rate + 0.3 * paper_growth_rate',
                },
            });
        } catch (err) {
            console.error('TopicController.getTopicMomentum:', err);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }

    getMostCitedPapers = async (req, res) => {
        try {
            const { limit = 10 } = req.query;
            const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));

            const rows = await this.topicModel.getMostCitedPapers(safeLimit);
            return res.status(200).json({ success: true, count: rows.length, data: rows });
        } catch (err) {
            console.error('TopicController.getMostCitedPapers:', err);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }

    getTopAuthorsByTopic = async (req, res) => {
        try {
            const { topicId } = req.params;
            const { limit = 10 } = req.query;

            if (isNaN(topicId)) {
                return res.status(400).json({ success: false, message: 'topicId must be a number.' });
            }

            const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
            const topic = await this.topicModel.getTopicById(Number(topicId));
            if (!topic) {
                return res.status(404).json({ success: false, message: 'Topic not found.' });
            }

            const rows = await this.topicModel.getTopAuthorsByTopicCitations(Number(topicId), safeLimit);
            return res.status(200).json({
                success: true,
                count: rows.length,
                data: rows,
                meta: {
                    topic_id: Number(topicId),
                    topic_name: topic.name,
                    field_name: topic.field_name,
                    domain_name: topic.domain_name,
                },
            });
        } catch (err) {
            console.error('TopicController.getTopAuthorsByTopic:', err);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }
}

module.exports = TopicController;
