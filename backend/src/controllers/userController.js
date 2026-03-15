const UserModel = require("../models/userModel.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record) {
    return { blocked: false };
  }

  if (now - record.firstAttempt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip);
    return { blocked: false };
  }

  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    const retryAfter = Math.ceil(
      (record.firstAttempt + LOGIN_WINDOW_MS - now) / 1000,
    );
    return { blocked: true, retryAfter };
  }

  return { blocked: false };
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record || now - record.firstAttempt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return;
  }

  record.count += 1;
}

function clearFailedLogins(ip) {
  loginAttempts.delete(ip);
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;

function validateEmail(email) {
  return typeof email === "string" && EMAIL_REGEX.test(email);
}

function validatePassword(password) {
  return typeof password === "string" && password.length >= PASSWORD_MIN_LENGTH;
}

function validateUsername(username) {
  return (
    typeof username === "string" &&
    username.length >= 3 &&
    username.length <= 30 &&
    /^[a-zA-Z0-9_]+$/.test(username)
  );
}

class UserController {
  constructor() {
    this.userModel = new UserModel();
  }

  createUser = async (req, res) => {
    try {
      const { username, full_name, email, password, phone_number, bio } =
        req.body;

      if (!username || !full_name || !email || !password) {
        return res.status(400).json({
          error: "username, full_name, email, and password are required.",
        });
      }

      if (!validateUsername(username)) {
        return res.status(400).json({
          error:
            "Username must be 3-30 characters and contain only letters, numbers, and underscores.",
        });
      }

      if (!validateEmail(email)) {
        return res.status(400).json({ error: "Invalid email format." });
      }

      if (!validatePassword(password)) {
        return res.status(400).json({
          error: "Password must be at least 8 characters long.",
        });
      }

      const status = await this.userModel.ensureStatusByName("active");
      if (!status) {
        return res
          .status(500)
          .json({ error: "Could not resolve active status." });
      }

      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;
      const password_hash = await bcrypt.hash(password, saltRounds);

      const user = await this.userModel.createUser({
        username,
        full_name,
        email,
        password_hash,
        phone_number: phone_number || null,
        status_id: status.id,
        bio: bio || null,
      });

      const token = jwt.sign(
        { userId: user.id, role: "user" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" },
      );

      await this.userModel.updateJwtToken(user.id, token);

      return res.status(201).json({ token, role: "user", userId: user.id });
    } catch (error) {
      if (error.code === "23505") {
        if (error.detail && error.detail.includes("email")) {
          return res.status(409).json({ error: "Email already in use." });
        }
        if (error.detail && error.detail.includes("username")) {
          return res.status(409).json({ error: "Username already taken." });
        }
        return res.status(409).json({
          error: "A user with that email or username already exists.",
        });
      }

      return res.status(500).json({ error: "Internal server error." });
    }
  };

  login = async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "email and password are required." });
      }

      if (!validateEmail(email)) {
        return res.status(400).json({ error: "Invalid email format." });
      }

      const clientIp = req.ip || req.connection.remoteAddress;
      const rateCheck = checkRateLimit(clientIp);
      if (rateCheck.blocked) {
        return res.status(429).json({
          error: `Too many failed login attempts. Please try again in ${rateCheck.retryAfter} seconds.`,
        });
      }

      const user = await this.userModel.getUserByEmail(email);
      if (!user) {
        recordFailedLogin(clientIp);
        return res.status(401).json({ error: "Invalid email or password." });
      }

      const status = await this.userModel.getStatusById(user.status_id);
      if (!status || status.status_name.toLowerCase() !== "active") {
        return res.status(403).json({
          error: "Your account is not active. Please contact support.",
        });
      }

      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) {
        recordFailedLogin(clientIp);
        return res.status(401).json({ error: "Invalid email or password." });
      }

      clearFailedLogins(clientIp);

      let role = "user";
      const researcher = await this.userModel.checkResearcherRole(user.id);
      if (researcher) {
        role = "researcher";
      } else {
        const venueUser = await this.userModel.checkVenueUserRole(user.id);
        if (venueUser) {
          role = "venue_user";
        }
      }

      const token = jwt.sign(
        { userId: user.id, role },
        process.env.JWT_SECRET,
        {
          expiresIn: "7d",
        },
      );

      await this.userModel.updateJwtToken(user.id, token);

      return res.status(200).json({ token, role, userId: user.id });
    } catch (error) {
      return res.status(500).json({ error: "Internal server error." });
    }
  };

  verifyToken = async (req, res) => {
    try {
      const userId = req.auth && req.auth.userId;
      if (!userId) {
        return res.status(401).json({ error: "Invalid token payload." });
      }

      const user = await this.userModel.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }

      return res.status(200).json({
        userId: user.id,
        role: req.auth.role || req.user?.role || "user",
      });
    } catch (error) {
      return res.status(500).json({ error: "Internal server error." });
    }
  };

  logout = async (req, res) => {
    try {
      const userId = req.auth.userId;

      await this.userModel.clearJwtToken(userId);

      return res.status(200).json({ message: "Logged out successfully." });
    } catch (error) {
      console.error("[logout]", error.message);
      return res.status(500).json({ error: "Internal server error." });
    }
  };

  changePassword = async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { current_password, new_password } = req.body;

      if (!current_password || !new_password) {
        return res.status(400).json({
          error: "current_password and new_password are required.",
        });
      }

      if (!validatePassword(new_password)) {
        return res.status(400).json({
          error: "New password must be at least 8 characters long.",
        });
      }

      const record = await this.userModel.getPasswordHashByUserId(userId);
      if (!record) {
        return res.status(404).json({ error: "User not found." });
      }

      const match = await bcrypt.compare(
        current_password,
        record.password_hash,
      );
      if (!match) {
        return res
          .status(401)
          .json({ error: "Current password is incorrect." });
      }

      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;
      const newHash = await bcrypt.hash(new_password, saltRounds);
      await this.userModel.updatePasswordHash(userId, newHash);
      await this.userModel.clearJwtToken(userId);

      return res.status(200).json({
        message:
          "Password changed successfully. Please log in again with your new password.",
      });
    } catch (error) {
      console.error("[changePassword]", error.message);
      return res.status(500).json({ error: "Internal server error." });
    }
  };

  getAllUsers = async (req, res) => {
    try {
      const users = await this.userModel.getAllUsers();
      return res.status(200).json({
        success: true,
        count: users.length,
        data: users,
      });
    } catch (error) {
      console.error("[getAllUsers]", error.message);
      return res.status(500).json({
        success: false,
        message: "Internal server error.",
      });
    }
  };

  getUserById = async (req, res) => {
    try {
      const { id } = req.params;

      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "id must be a number." });
      }

      const user = await this.userModel.getUserById(Number(id));

      if (!user) {
        return res.status(404).json({
          success: false,
          message: `User with id ${id} not found.`,
        });
      }

      return res.status(200).json({ success: true, data: user });
    } catch (error) {
      console.error("[getUserById]", error.message);
      return res.status(500).json({
        success: false,
        message: "Internal server error.",
      });
    }
  };

  updateUser = async (req, res) => {
    try {
      const { id } = req.params;

      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "id must be a number." });
      }

      const { username, full_name, email, phone_number, profile_pic_url, bio } =
        req.body;

      if (!username || !full_name || !email) {
        return res.status(400).json({
          success: false,
          message: "username, full_name, and email are required.",
        });
      }

      const user = await this.userModel.updateUser(Number(id), {
        username,
        full_name,
        email,
        phone_number,
        profile_pic_url,
        bio,
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: `User with id ${id} not found.`,
        });
      }

      return res.status(200).json({
        success: true,
        message: "User updated successfully.",
        data: user,
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "A user with that email or username already exists.",
        });
      }
      console.error("[updateUser]", error.message);
      return res.status(500).json({
        success: false,
        message: "Internal server error.",
      });
    }
  };

  deleteUser = async (req, res) => {
    try {
      const { id } = req.params;

      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "id must be a number." });
      }

      const user = await this.userModel.deleteUser(Number(id));

      if (!user) {
        return res.status(404).json({
          success: false,
          message: `User with id ${id} not found.`,
        });
      }

      return res.status(200).json({
        success: true,
        message: "User deleted successfully.",
        data: user,
      });
    } catch (error) {
      console.error("[deleteUser]", error.message);
      return res.status(500).json({
        success: false,
        message: "Internal server error.",
      });
    }
  };

  followUser = async (req, res) => {
    try {
      const { id } = req.params;
      const { followingUserId } = req.body;

      if (isNaN(id) || !followingUserId || isNaN(followingUserId)) {
        return res.status(400).json({
          success: false,
          message: "id (param) and followingUserId (body) must be numbers.",
        });
      }

      if (Number(id) === Number(followingUserId)) {
        return res.status(400).json({
          success: false,
          message: "A user cannot follow themselves.",
        });
      }

      const follow = await this.userModel.followUser(
        Number(followingUserId),
        Number(id),
      );

      return res.status(201).json({
        success: true,
        message: "Followed successfully.",
        data: follow,
      });
    } catch (error) {
      if (error.code === "23505") {
        return res
          .status(409)
          .json({ success: false, message: "Already following this user." });
      }
      if (error.code === "23503") {
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }
      console.error("[followUser]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  unfollowUser = async (req, res) => {
    try {
      const { id } = req.params;
      const { followingUserId } = req.body;

      if (isNaN(id) || !followingUserId || isNaN(followingUserId)) {
        return res.status(400).json({
          success: false,
          message: "id (param) and followingUserId (body) must be numbers.",
        });
      }

      const follow = await this.userModel.unfollowUser(
        Number(followingUserId),
        Number(id),
      );

      if (!follow) {
        return res
          .status(404)
          .json({ success: false, message: "Follow relationship not found." });
      }

      return res.status(200).json({
        success: true,
        message: "Unfollowed successfully.",
        data: follow,
      });
    } catch (error) {
      console.error("[unfollowUser]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  getFollowers = async (req, res) => {
    try {
      const { id } = req.params;

      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "id must be a number." });
      }

      const followers = await this.userModel.getFollowers(Number(id));
      return res
        .status(200)
        .json({ success: true, count: followers.length, data: followers });
    } catch (error) {
      console.error("[getFollowers]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  getFollowing = async (req, res) => {
    try {
      const { id } = req.params;

      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "id must be a number." });
      }

      const following = await this.userModel.getFollowing(Number(id));
      return res
        .status(200)
        .json({ success: true, count: following.length, data: following });
    } catch (error) {
      console.error("[getFollowing]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  getAllStatuses = async (req, res) => {
    try {
      const statuses = await this.userModel.getAllStatuses();
      return res.status(200).json({ success: true, data: statuses });
    } catch (error) {
      console.error("[getAllStatuses]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  addToUserLibrary = async (req, res) => {
    try {
      const { id } = req.params;
      const { paper_id } = req.body;

      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "id must be a number." });
      }
      if (!paper_id || isNaN(paper_id)) {
        return res.status(400).json({
          success: false,
          message: "paper_id is required and must be a number.",
        });
      }

      const entry = await this.userModel.addToUserLibrary(
        Number(id),
        Number(paper_id),
      );
      return res.status(201).json({
        success: true,
        message: "Paper added to library.",
        data: entry,
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "Paper is already in this user's library.",
        });
      }
      if (error.code === "23503") {
        return res
          .status(404)
          .json({ success: false, message: "User or paper not found." });
      }
      console.error("[addToLibrary]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  removeFromUserLibrary = async (req, res) => {
    try {
      const { id, paperId } = req.params;

      if (isNaN(id) || isNaN(paperId)) {
        return res
          .status(400)
          .json({ success: false, message: "id and paperId must be numbers." });
      }

      const entry = await this.userModel.removeFromUserLibrary(
        Number(id),
        Number(paperId),
      );

      if (!entry) {
        return res
          .status(404)
          .json({ success: false, message: "Paper not found in library." });
      }

      return res.status(200).json({
        success: true,
        message: "Paper removed from library.",
        data: entry,
      });
    } catch (error) {
      console.error("[removeFromLibrary]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  getUserLibrary = async (req, res) => {
    try {
      const { id } = req.params;

      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "id must be a number." });
      }

      const library = await this.userModel.getUserLibrary(Number(id));
      return res
        .status(200)
        .json({ success: true, count: library.length, data: library });
    } catch (error) {
      console.error("[getUserLibrary]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  createFeedback = async (req, res) => {
    try {
      const { sender_id, receiver_id, message } = req.body;

      if (
        !sender_id ||
        isNaN(sender_id) ||
        !receiver_id ||
        isNaN(receiver_id) ||
        !message
      ) {
        return res.status(400).json({
          success: false,
          message: "sender_id, receiver_id, and message are required.",
        });
      }

      if (Number(sender_id) === Number(receiver_id)) {
        return res.status(400).json({
          success: false,
          message: "A user cannot send feedback to themselves.",
        });
      }

      const feedback = await this.userModel.createFeedback(
        Number(sender_id),
        Number(receiver_id),
        message,
      );
      return res
        .status(201)
        .json({ success: true, message: "Feedback sent.", data: feedback });
    } catch (error) {
      if (error.code === "23503")
        return res
          .status(400)
          .json({ success: false, message: "Sender or receiver not found." });
      if (error.code === "23514")
        return res.status(400).json({
          success: false,
          message: "A user cannot send feedback to themselves.",
        });
      console.error("[createFeedback]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  getFeedbackById = async (req, res) => {
    try {
      const { id } = req.params;
      if (isNaN(id))
        return res
          .status(400)
          .json({ success: false, message: "id must be a number." });

      const feedback = await this.userModel.getFeedbackById(Number(id));
      if (!feedback)
        return res.status(404).json({
          success: false,
          message: `Feedback with id ${id} not found.`,
        });
      return res.status(200).json({ success: true, data: feedback });
    } catch (error) {
      console.error("[getFeedbackById]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  getFeedbackBySender = async (req, res) => {
    try {
      const { id } = req.params;
      if (isNaN(id))
        return res
          .status(400)
          .json({ success: false, message: "id must be a number." });

      const feedbacks = await this.userModel.getFeedbackBySender(Number(id));
      return res
        .status(200)
        .json({ success: true, count: feedbacks.length, data: feedbacks });
    } catch (error) {
      console.error("[getFeedbackBySender]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  getFeedbackByReceiver = async (req, res) => {
    try {
      const { id } = req.params;
      if (isNaN(id))
        return res
          .status(400)
          .json({ success: false, message: "id must be a number." });

      const feedbacks = await this.userModel.getFeedbackByReceiver(Number(id));
      return res
        .status(200)
        .json({ success: true, count: feedbacks.length, data: feedbacks });
    } catch (error) {
      console.error("[getFeedbackByReceiver]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };

  deleteFeedback = async (req, res) => {
    try {
      const { id } = req.params;
      if (isNaN(id))
        return res
          .status(400)
          .json({ success: false, message: "id must be a number." });

      const removed = await this.userModel.deleteFeedback(Number(id));
      if (!removed)
        return res.status(404).json({
          success: false,
          message: `Feedback with id ${id} not found.`,
        });
      return res
        .status(200)
        .json({ success: true, message: "Feedback deleted.", data: removed });
    } catch (error) {
      console.error("[deleteFeedback]", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }
  };
}

module.exports = UserController;
