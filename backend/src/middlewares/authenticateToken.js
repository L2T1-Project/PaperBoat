const UserModel = require("../models/userModel.js");
const jwt = require("jsonwebtoken");

class AuthenticateToken {
  constructor() {
    this.userModel = new UserModel();
  }

  authenticateToken = async (req, res, next) => {
    try {
      if (process.env.BYPASS === "true") {
        return next();
      }

      const authHeader =
        req.headers["authorization"] || req.headers["Authorization"];
      const token = authHeader && authHeader.split(" ")[1];

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Access token required",
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.auth = decoded;

      const userId = decoded.userId;
      const user = await this.userModel.getUserById(userId);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      const storedToken = await this.userModel.getJwtTokenByUserId(userId);
      if (!storedToken || storedToken.jwt_token !== token) {
        return res.status(401).json({
          success: false,
          message: "Token has been revoked. Please log in again.",
        });
      }

      req.user = user;
      if (req.user && !req.user.role && decoded && decoded.role) {
        req.user.role = decoded.role;
      }
      next();
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token expired",
        });
      }
      return res.status(403).json({
        success: false,
        message: "Invalid token",
      });
    }
  };
}

module.exports = AuthenticateToken;
