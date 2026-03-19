const FollowModel = require('../models/followModel.js');
const NotificationModel = require('../models/notificationModel.js');

class FollowController {
  constructor() {
    this.followModel = new FollowModel();
    this.notificationModel = new NotificationModel();
  }

  followResearcher = async (req, res) => {
    try {
      const followingUserId = req.auth.userId;
      const followedUserId  = Number(req.params.userId);
      if (followingUserId === followedUserId) {
        return res.status(400).json({ success: false, message: 'Cannot follow yourself.' });
      }
      await this.followModel.followUser(followingUserId, followedUserId);
      // Fire-and-forget notification
      this.followModel.getUserFullName(followingUserId)
        .then(name => this.notificationModel.notifyNewFollower(followingUserId, followedUserId, name))
        .catch(err => console.error('follow notification error:', err));
      res.status(201).json({ success: true, message: 'Now following.' });
    } catch (err) {
      console.error('followResearcher error:', err);
      res.status(500).json({ success: false, message: 'Failed to follow.' });
    }
  };

  unfollowResearcher = async (req, res) => {
    try {
      await this.followModel.unfollowUser(req.auth.userId, Number(req.params.userId));
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
