const FollowModel = require('../models/followModel.js');

class FollowController {
  constructor() {
    this.followModel = new FollowModel();
  }

  followResearcher = async (req, res) => {
    try {
      const followingUserId = req.auth.userId;
      const followedUserId  = Number(req.params.userId);
      if (followingUserId === followedUserId) {
        return res.status(400).json({ success: false, message: 'Cannot follow yourself.' });
      }
      const inserted = await this.followModel.followUser(followingUserId, followedUserId);

      if (inserted) {
        // Requirement: after follow insert, call notify_new_follower procedure.
        this.followModel.notifyNewFollower(followingUserId, followedUserId)
          .catch((err) => console.error('follow notification procedure error:', err));
        return res.status(201).json({ success: true, message: 'Now following.' });
      }

      return res.status(200).json({ success: true, message: 'Already following.' });
    } catch (err) {
      console.error('followResearcher error:', err);
      res.status(500).json({ success: false, message: 'Failed to follow.' });
    }
  };

  unfollowResearcher = async (req, res) => {
    try {
      await this.followModel.unfollowUser(req.auth.userId, Number(req.params.userId));
      // Requirement: no notification on unfollow.
      res.json({ success: true, message: 'Unfollowed.' });
    } catch (err) {
      console.error('unfollowResearcher error:', err);
      res.status(500).json({ success: false, message: 'Failed to unfollow.' });
    }
  };

  getFollowStatus = async (req, res) => {
    try {
      const following = await this.followModel.isFollowing(req.auth.userId, Number(req.params.userId));
      res.json({ success: true, data: { following } });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to check follow status.' });
    }
  };

  getMyFollowers = async (req, res) => {
    try {
      const followers = await this.followModel.getFollowers(req.auth.userId);
      res.json({ success: true, data: followers });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch followers.' });
    }
  };

  getMyFollowing = async (req, res) => {
    try {
      const following = await this.followModel.getFollowing(req.auth.userId);
      res.json({ success: true, data: following });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch following.' });
    }
  };
}

module.exports = FollowController;
