// src/controllers/upload.controller.js
const { prisma } = require("../config/database");
const { ApiResponse } = require("../utils/ApiResponse");
const { deleteImage } = require("../config/cloudinary");

// ── POST /upload/product-images ──────────────────
async function uploadProductImages(req, res) {
  if (!req.files || req.files.length === 0) {
    return ApiResponse.badRequest(res, "No images uploaded");
  }

  const urls = req.files.map((file) => file.path); // Cloudinary URL

  // إذا تم تمرير productId نحدث المنتج مباشرة
  const { productId } = req.body;
  if (productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, images: true },
    });

    if (!product) return ApiResponse.notFound(res, "Product");

    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: { images: [...product.images, ...urls] },
      select: { id: true, name: true, images: true },
    });

    return ApiResponse.success(res, updatedProduct, "Images uploaded successfully");
  }

  return ApiResponse.success(res, { urls }, "Images uploaded");
}

// ── POST /upload/avatar ──────────────────────────
async function uploadAvatar(req, res) {
  if (!req.file) {
    return ApiResponse.badRequest(res, "No image uploaded");
  }

  const avatarUrl = req.file.path;

  // حذف الـ avatar القديم من Cloudinary إذا موجود
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { avatarUrl: true },
  });

  if (user?.avatarUrl) {
    // استخراج الـ public_id من الـ URL
    const parts = user.avatarUrl.split("/");
    const publicId = `godmode-store/avatars/${parts[parts.length - 1].split(".")[0]}`;
    await deleteImage(publicId);
  }

  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: { avatarUrl },
    select: { id: true, email: true, avatarUrl: true },
  });

  return ApiResponse.success(res, updatedUser, "Avatar updated successfully");
}

module.exports = { uploadProductImages, uploadAvatar };
