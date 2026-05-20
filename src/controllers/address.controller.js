// src/controllers/address.controller.js
const { prisma } = require("../config/database");
const { ApiResponse } = require("../utils/ApiResponse");

// ── GET /addresses ───────────────────────────────
async function getAddresses(req, res) {
  const addresses = await prisma.address.findMany({
    where: { userId: req.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return ApiResponse.success(res, addresses);
}

// ── POST /addresses ──────────────────────────────
async function createAddress(req, res) {
  const { fullName, street, city, state, zip, country = "US", isDefault = false } = req.body;

  if (!fullName || !street || !city || !zip) {
    return ApiResponse.badRequest(res, "fullName, street, city, and zip are required");
  }

  // إذا isDefault → ارفع الـ default عن الباقين
  if (isDefault) {
    await prisma.address.updateMany({
      where: { userId: req.user.id },
      data: { isDefault: false },
    });
  }

  // إذا أول عنوان → اجعله default تلقائياً
  const count = await prisma.address.count({ where: { userId: req.user.id } });
  const shouldBeDefault = isDefault || count === 0;

  const address = await prisma.address.create({
    data: {
      userId: req.user.id,
      fullName, street, city,
      state: state || null,
      zip, country,
      isDefault: shouldBeDefault,
    },
  });

  return ApiResponse.created(res, address, "Address added successfully");
}

// ── PUT /addresses/:id ───────────────────────────
async function updateAddress(req, res) {
  const { id } = req.params;
  const { fullName, street, city, state, zip, country, isDefault } = req.body;

  // تحقق الملكية
  const existing = await prisma.address.findUnique({
    where: { id, userId: req.user.id },
  });
  if (!existing) return ApiResponse.notFound(res, "Address");

  if (isDefault) {
    await prisma.address.updateMany({
      where: { userId: req.user.id, id: { not: id } },
      data: { isDefault: false },
    });
  }

  const address = await prisma.address.update({
    where: { id },
    data: {
      ...(fullName !== undefined && { fullName }),
      ...(street !== undefined && { street }),
      ...(city !== undefined && { city }),
      ...(state !== undefined && { state }),
      ...(zip !== undefined && { zip }),
      ...(country !== undefined && { country }),
      ...(isDefault !== undefined && { isDefault }),
    },
  });

  return ApiResponse.success(res, address, "Address updated");
}

// ── DELETE /addresses/:id ────────────────────────
async function deleteAddress(req, res) {
  const { id } = req.params;

  const existing = await prisma.address.findUnique({
    where: { id, userId: req.user.id },
  });
  if (!existing) return ApiResponse.notFound(res, "Address");

  await prisma.address.delete({ where: { id } });

  // إذا كان default → اجعل الأحدث default
  if (existing.isDefault) {
    const next = await prisma.address.findFirst({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    if (next) {
      await prisma.address.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }

  return ApiResponse.success(res, null, "Address deleted");
}

// ── PATCH /addresses/:id/default ────────────────
async function setDefault(req, res) {
  const { id } = req.params;

  const existing = await prisma.address.findUnique({
    where: { id, userId: req.user.id },
  });
  if (!existing) return ApiResponse.notFound(res, "Address");

  await prisma.$transaction([
    prisma.address.updateMany({
      where: { userId: req.user.id },
      data: { isDefault: false },
    }),
    prisma.address.update({
      where: { id },
      data: { isDefault: true },
    }),
  ]);

  return ApiResponse.success(res, null, "Default address updated");
}

module.exports = { getAddresses, createAddress, updateAddress, deleteAddress, setDefault };
