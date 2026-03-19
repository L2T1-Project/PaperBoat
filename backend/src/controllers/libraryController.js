const LibraryModel = require('../models/libraryModel.js');

class LibraryController {
  constructor() {
    this.libraryModel = new LibraryModel();
  }

  getSavedPapers = async (req, res) => {
    try {
      const papers = await this.libraryModel.getSavedPapers(req.auth.userId);
      res.json({ success: true, data: papers });
    } catch (err) {
      console.error('getSavedPapers error:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch library.' });
    }
  };

  savePaper = async (req, res) => {
    try {
      await this.libraryModel.savePaper(req.auth.userId, Number(req.params.paperId));
      res.status(201).json({ success: true, message: 'Paper saved to library.' });
    } catch (err) {
      console.error('savePaper error:', err);
      res.status(500).json({ success: false, message: 'Failed to save paper.' });
    }
  };

  unsavePaper = async (req, res) => {
    try {
      await this.libraryModel.unsavePaper(req.auth.userId, Number(req.params.paperId));
      res.json({ success: true, message: 'Paper removed from library.' });
    } catch (err) {
      console.error('unsavePaper error:', err);
      res.status(500).json({ success: false, message: 'Failed to remove paper.' });
    }
  };

  checkSaved = async (req, res) => {
    try {
      const saved = await this.libraryModel.isSaved(req.auth.userId, Number(req.params.paperId));
      res.json({ success: true, data: { saved } });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to check save status.' });
    }
  };
}

module.exports = LibraryController;
