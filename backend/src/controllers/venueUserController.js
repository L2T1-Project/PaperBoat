const VenueUserModel = require("../models/venueUserModel.js");
const UserModel = require("../models/userModel.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

class VenueUserController {
  constructor() {
    this.venueUserModel = new VenueUserModel();
    this.userModel = new UserModel();
  }

  createVenueUser = async (req, res) => {
    try {
      const {
        full_name,
        username,
        email,
        password,
        phone_number,
        bio,
        venue_id,
      } = req.body;

      if (!full_name || !username || !email || !password || !venue_id) {
        return res.status(400).json({
          error:
            "full_name, username, email, password, and venue_id are required.",
        });
      }

      const status = await this.userModel.getStatusByName("active");
      if (!status) {
        return res
          .status(500)
          .json({ error: "Could not resolve active status." });
      }

      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;
      const password_hash = await bcrypt.hash(password, saltRounds);

      const user = await this.venueUserModel.signupVenueUser({
        username,
        full_name,
        email,
        password_hash,
        phone_number: phone_number || null,
        status_id: status.id,
        bio: bio || null,
        venue_id: Number(venue_id),
      });

      const token = jwt.sign(
        { userId: user.id, role: "venue_user" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" },
      );

      await this.userModel.updateJwtToken(user.id, token);

      return res
        .status(201)
        .json({ token, role: "venue_user", userId: user.id });
    } catch (err) {
      if (err.code === "23505") {
        if (err.detail && err.detail.includes("email")) {
          return res.status(409).json({ error: "Email already in use." });
        }
        if (err.detail && err.detail.includes("username")) {
          return res.status(409).json({ error: "Username already taken." });
        }
        if (err.detail && err.detail.includes("venue_id")) {
          return res
            .status(409)
            .json({ error: "This venue has already been claimed." });
        }
      }

      return res.status(500).json({ error: "Internal server error" });
    }
  };

  getAllVenueUsers = async (req, res) => {
    try {
      const venueUsers = await this.venueUserModel.getAllVenueUsers();
      return res.status(200).json(venueUsers);
    } catch (err) {
      console.error("VenueUserController.getAllVenueUsers:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  };

  getVenueUserById = async (req, res) => {
    try {
      const { id } = req.params;
      const venueUser = await this.venueUserModel.getVenueUserById(id);

      if (!venueUser)
        return res.status(404).json({ error: "Venue user not found" });
      return res.status(200).json(venueUser);
    } catch (err) {
      console.error("VenueUserController.getVenueUserById:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  };

  deleteVenueUser = async (req, res) => {
    try {
      const { id } = req.params;
      const removed = await this.venueUserModel.deleteVenueUser(id);

      if (!removed)
        return res.status(404).json({ error: "Venue user not found" });
      return res
        .status(200)
        .json({
          message: "Venue user removed successfully",
          user_id: removed.user_id,
        });
    } catch (err) {
      console.error("VenueUserController.deleteVenueUser:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}

module.exports = VenueUserController;
