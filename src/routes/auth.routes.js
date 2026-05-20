// src/routes/auth.routes.js
const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const { authenticate } = require("../middleware/auth.middleware");
const authController = require("../controllers/auth.controller");

// Strict rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  message: { success: false, error: "Too many auth attempts, try again in 15 minutes." },
});

// Public routes
router.post("/register", authLimiter, authController.register);
router.post("/login", authLimiter, authController.login);
router.post("/logout", authController.logout);
router.post("/refresh", authController.refreshToken);
router.post("/forgot-password", authLimiter, authController.forgotPassword);
router.post("/reset-password/:token", authLimiter, authController.resetPassword);
router.get("/verify-email/:token", authController.verifyEmail);

// Google OAuth
router.get("/google", authController.googleAuth);
router.get("/google/callback", authController.googleCallback);

// Protected routes
router.get("/me", authenticate, authController.getMe);
router.patch("/me", authenticate, authController.updateMe);
router.patch("/me/password", authenticate, authController.changePassword);

module.exports = router;
