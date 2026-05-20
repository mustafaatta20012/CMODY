// src/routes/upload.routes.js
const router = require("express").Router();
const { authenticate, requireAdmin } = require("../middleware/auth.middleware");
const uploadController = require("../controllers/upload.controller");
const { uploadMiddleware, avatarUpload } = require("../config/cloudinary");

router.post(
  "/product-images",
  authenticate,
  requireAdmin,
  uploadMiddleware.array("images", parseInt(process.env.MAX_FILES_PER_PRODUCT) || 6),
  uploadController.uploadProductImages
);

router.post(
  "/avatar",
  authenticate,
  avatarUpload.single("avatar"),
  uploadController.uploadAvatar
);

module.exports = router;
