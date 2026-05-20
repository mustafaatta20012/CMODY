// src/routes/chat.routes.js
// Claude AI chatbot — API key is SAFE on the server side now
const router = require("express").Router();
const { optionalAuth } = require("../middleware/auth.middleware");
const chatController = require("../controllers/chat.controller");
const rateLimit = require("express-rate-limit");

const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,             // 20 messages/minute per IP
  message: { success: false, error: "Slow down! Too many messages." },
});

router.post("/message", optionalAuth, chatLimiter, chatController.sendMessage);
router.get("/session/:sessionKey", chatController.getSession);
router.delete("/session/:sessionKey", chatController.clearSession);

module.exports = router;
