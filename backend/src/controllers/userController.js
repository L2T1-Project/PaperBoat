const UserModel = require("../models/userModel.js");
const { uploadUserProfileImage } = require("../utils/cloudinary.js");
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
      const admin = await this.userModel.checkAdminRole(user.id);
      if (admin) {
        role = "admin";
      } else {
        const researcher = await this.userModel.checkResearcherRole(user.id);
        if (researcher) {
          role = "researcher";
        } else {
          const venueUser = await this.userModel.checkVenueUserRole(user.id);
          if (venueUser) {
            role = "venue_user";
          }
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

  getMyProfile = async (req, res) => {
    try {
      const userId = req.auth?.userId;
      const profile = await this.userModel.getMyProfile(userId);

      if (!profile) {
        return res.status(404).json({ success: false, message: "User not found." });
      }

      return res.status(200).json({ success: true, data: profile });
    } catch (error) {
      console.error("[getMyProfile]", error.message);
      return res.status(500).json({ success: false, message: "Internal server error." });
    }
  };

  updateMyProfile = async (req, res) => {
    try {
      const userId = req.auth?.userId;
      const role = String(req.auth?.role || req.user?.role || "user").toLowerCase();

      const forbiddenKeys = ["username", "email", "orc_id", "issn"];
      for (const key of forbiddenKeys) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
          return res.status(400).json({
            success: false,
            message: `${key} cannot be edited from this form.`,
          });
        }
      }

      const payload = {};
      if (Object.prototype.hasOwnProperty.call(req.body, "phone_number")) {
        payload.phone_number = req.body.phone_number?.trim() || null;
      }
      if (Object.prototype.hasOwnProperty.call(req.body, "bio")) {
        payload.bio = req.body.bio?.trim() || null;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, "full_name")) {
        if (role !== "user") {
          return res.status(403).json({
            success: false,
            message: "Only normal users can edit full name. Please contact admin via Feedback.",
          });
        }

        const nextFullName = req.body.full_name?.trim();
        if (!nextFullName) {
          return res.status(400).json({ success: false, message: "full_name cannot be empty." });
        }
        payload.full_name = nextFullName;
      }

      const updated = await this.userModel.updateMyProfile(userId, payload);
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("[updateMyProfile]", error.message);
      return res.status(500).json({ success: false, message: "Internal server error." });
    }
  };

  uploadMyProfilePhoto = async (req, res) => {
    try {
      const userId = req.auth?.userId;
      if (!req.file?.buffer) {
        return res.status(400).json({ success: false, message: "Image file is required." });
      }

      const imageUrl = await uploadUserProfileImage(req.file.buffer, userId, req.file.mimetype);
      const updated = await this.userModel.updateMyProfile(userId, { profile_pic_url: imageUrl });

      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("[uploadMyProfilePhoto]", error.message);
      const details = String(error?.message || "");
      if (details.toLowerCase().includes("cloudinary")) {
        return res.status(500).json({
          success: false,
          message: "Failed to upload image to Cloudinary. Verify CLOUDINARY_* settings in backend/.env.",
        });
      }
      return res.status(500).json({
        success: false,
        message: details || "Failed to upload image.",
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

  getUserDisplayName = async (req, res) => {
    try {
      const { id } = req.params;

      if (isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "id must be a number." });
      }

      if (req.auth?.userId !== Number(id)) {
        return res.status(403).json({ success: false, message: "Forbidden." });
      }

      const user = await this.userModel.getUserDisplayNameById(Number(id));

      if (!user) {
        return res.status(404).json({
          success: false,
          message: `User with id ${id} not found.`,
        });
      }

      return res.status(200).json({ success: true, data: user });
    } catch (error) {
      console.error("[getUserDisplayName]", error.message);
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
}

module.exports = UserController;
