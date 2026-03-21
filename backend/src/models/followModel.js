const DB_Connection = require("../database/db.js");

class FollowModel {
  constructor() {
    this.db = DB_Connection.getInstance();
  }

  followUser = async (followingUserId, followedUserId) => {
    const result = await this.db.query_executor(
      `INSERT INTO follows (following_user_id, followed_user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING following_user_id`,
      [followingUserId, followedUserId]
    );
    return result.rowCount > 0;
  };

  unfollowUser = async (followingUserId, followedUserId) => {
    await this.db.query_executor(
      `DELETE FROM follows WHERE following_user_id = $1 AND followed_user_id = $2`,
      [followingUserId, followedUserId]
    );
  };

  notifyNewFollower = async (followerUserId, followedUserId) => {
    await this.db.query_executor(
      `CALL notify_new_follower($1, $2)`,
      [followerUserId, followedUserId]
    );
  };

  isFollowing = async (followingUserId, followedUserId) => {
    const result = await this.db.query_executor(
      `SELECT 1 FROM follows WHERE following_user_id = $1 AND followed_user_id = $2`,
      [followingUserId, followedUserId]
    );
    return result.rowCount > 0;
  };

  getFollowers = async (userId) => {
    const result = await this.db.query_executor(`
      SELECT u.id, u.full_name, u.username, u.profile_pic_url,
             (r.user_id IS NOT NULL) AS is_researcher
      FROM follows f
      JOIN "user" u ON u.id = f.following_user_id
      LEFT JOIN researcher r ON r.user_id = u.id
      WHERE f.followed_user_id = $1
      ORDER BY u.full_name
    `, [userId]);
    return result.rows;
  };

  getFollowing = async (userId) => {
    const result = await this.db.query_executor(`
      SELECT u.id, u.full_name, u.username, u.profile_pic_url,
             (r.user_id IS NOT NULL) AS is_researcher
      FROM follows f
      JOIN "user" u ON u.id = f.followed_user_id
      LEFT JOIN researcher r ON r.user_id = u.id
      WHERE f.following_user_id = $1
      ORDER BY u.full_name
    `, [userId]);
    return result.rows;
  };

}

module.exports = FollowModel;
