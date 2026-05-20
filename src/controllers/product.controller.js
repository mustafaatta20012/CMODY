// src/controllers/product.controller.js
const { prisma } = require("../config/database");
const { ApiResponse } = require("../utils/ApiResponse");
const { cacheGet, cacheSet, cacheDel, cacheDelPattern } = require("../config/redis");

const PRODUCT_CACHE_TTL = 300; // 5 minutes

// ── GET all products ─────────────────────────────
async function getAll(req, res) {
  const {
    category, page = 1, limit = 12,
    sort = "popular", minPrice, maxPrice,
    featured, badge,
  } = req.query;

  const cacheKey = `products:list:${JSON.stringify(req.query)}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return ApiResponse.paginated(res, cached.data, cached.meta);

  const where = { isActive: true };
  if (category) where.category = category;
  if (featured === "true") where.isFeatured = true;
  if (badge) where.badge = badge;
  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) where.price.gte = parseFloat(minPrice);
    if (maxPrice) where.price.lte = parseFloat(maxPrice);
  }

  const orderBy = {
    popular: { reviewCount: "desc" },
    low:     { price: "asc" },
    high:    { price: "desc" },
    newest:  { createdAt: "desc" },
    rating:  { ratingAvg: "desc" },
  }[sort] || { reviewCount: "desc" };

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where, orderBy,
      skip, take: parseInt(limit),
      select: {
        id: true, name: true, slug: true, price: true,
        category: true, badge: true, images: true,
        ratingAvg: true, reviewCount: true, stock: true,
        isFeatured: true, isActive: true,
      },
    }),
    prisma.product.count({ where }),
  ]);

  const meta = { page: parseInt(page), limit: parseInt(limit), total };
  await cacheSet(cacheKey, { data: products, meta }, PRODUCT_CACHE_TTL);

  return ApiResponse.paginated(res, products, meta);
}

// ── GET single product ───────────────────────────
async function getOne(req, res) {
  const { id } = req.params;
  const cacheKey = `product:${id}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return ApiResponse.success(res, cached);

  const product = await prisma.product.findFirst({
    where: { OR: [{ id }, { slug: id }], isActive: true },
    include: {
      reviews: {
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { firstName: true, lastName: true } } },
      },
    },
  });

  if (!product) return ApiResponse.notFound(res, "Product");

  await cacheSet(cacheKey, product, PRODUCT_CACHE_TTL);
  return ApiResponse.success(res, product);
}

// ── GET featured products ─────────────────────────
async function getFeatured(req, res) {
  const cached = await cacheGet("products:featured");
  if (cached) return ApiResponse.success(res, cached);

  const products = await prisma.product.findMany({
    where: { isActive: true, isFeatured: true },
    orderBy: { reviewCount: "desc" },
    take: 12,
    select: {
      id: true, name: true, slug: true, price: true,
      category: true, badge: true, images: true,
      ratingAvg: true, reviewCount: true, isFeatured: true,
    },
  });

  await cacheSet("products:featured", products, PRODUCT_CACHE_TTL);
  return ApiResponse.success(res, products);
}

// ── Search ───────────────────────────────────────
async function search(req, res) {
  const { q, category, sort = "relevant", page = 1, limit = 12 } = req.query;
  if (!q || q.trim().length < 2) {
    return ApiResponse.badRequest(res, "Search query must be at least 2 characters");
  }

  const where = {
    isActive: true,
    OR: [
      { name:        { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ],
  };
  if (category && category !== "all") where.category = category;

  const orderBy = {
    relevant: { reviewCount: "desc" },
    low:      { price: "asc" },
    high:     { price: "desc" },
    rating:   { ratingAvg: "desc" },
  }[sort] || { reviewCount: "desc" };

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where, orderBy, skip, take: parseInt(limit),
      select: {
        id: true, name: true, slug: true, price: true,
        category: true, badge: true, images: true,
        ratingAvg: true, reviewCount: true,
      },
    }),
    prisma.product.count({ where }),
  ]);

  return ApiResponse.paginated(res, products, { page: parseInt(page), limit: parseInt(limit), total });
}

// ── Get Reviews ───────────────────────────────────
async function getReviews(req, res) {
  const { id } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [reviews, total] = await prisma.$transaction([
    prisma.review.findMany({
      where: { productId: id },
      orderBy: { createdAt: "desc" },
      skip, take: parseInt(limit),
      include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
    }),
    prisma.review.count({ where: { productId: id } }),
  ]);

  return ApiResponse.paginated(res, reviews, { page: parseInt(page), limit: parseInt(limit), total });
}

// ── Add Review ────────────────────────────────────
async function addReview(req, res) {
  const { id: productId } = req.params;
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return ApiResponse.badRequest(res, "Rating must be between 1 and 5");
  }

  const purchased = await prisma.orderItem.findFirst({
    where: {
      productId,
      order: { userId: req.user.id, status: { in: ["PAID", "DELIVERED"] } },
    },
  });

  const review = await prisma.review.upsert({
    where: { productId_userId: { productId, userId: req.user.id } },
    update: { rating, comment: comment || null },
    create: {
      productId, userId: req.user.id,
      rating, comment: comment || null,
      isVerified: !!purchased,
    },
  });

  const agg = await prisma.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: { id: true },
  });

  await prisma.product.update({
    where: { id: productId },
    data: { ratingAvg: agg._avg.rating || 0, reviewCount: agg._count.id },
  });

  await cacheDel(`product:${productId}`);
  return ApiResponse.created(res, review, "Review submitted");
}

// ── Create Product (Admin) ────────────────────────
async function create(req, res) {
  const { name, description, price, stock, category, badge, isFeatured, images } = req.body;

  if (!name || !description || !price || !category) {
    return ApiResponse.badRequest(res, "name, description, price and category are required");
  }

  // Generate unique slug
  const baseSlug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const timestamp = Date.now();
  const slug = `${baseSlug}-${timestamp}`;

  const product = await prisma.product.create({
    data: {
      name, description, slug,
      price:      parseFloat(price),
      stock:      parseInt(stock) || 0,
      category,
      badge:      badge || null,
      isFeatured: isFeatured === true || isFeatured === "true",
      images:     Array.isArray(images) ? images : (images ? [images] : []),
    },
  });

  await cacheDelPattern("products:*");
  return ApiResponse.created(res, product);
}

// ── Update Product (Admin) ────────────────────────
async function update(req, res) {
  const { id } = req.params;
  const data = { ...req.body };

  // Sanitize types
  if (data.price     !== undefined) data.price     = parseFloat(data.price);
  if (data.stock     !== undefined) data.stock     = parseInt(data.stock);
  if (data.isFeatured !== undefined) data.isFeatured = data.isFeatured === true || data.isFeatured === "true";
  if (data.isActive  !== undefined) data.isActive  = data.isActive  === true || data.isActive  === "true";
  if (data.images    !== undefined) data.images    = Array.isArray(data.images) ? data.images : [data.images];
  if (data.name) {
    const baseSlug = data.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    data.slug = `${baseSlug}-${Date.now()}`;
  }

  // Remove fields that shouldn't be updated directly
  delete data.id;
  delete data.createdAt;
  delete data.reviewCount;
  delete data.ratingAvg;

  const product = await prisma.product.update({ where: { id }, data });

  await Promise.all([cacheDel(`product:${id}`), cacheDelPattern("products:*")]);
  return ApiResponse.success(res, product, "Product updated");
}

// ── Delete Product (Admin) — Soft Delete ─────────
async function remove(req, res) {
  const { id } = req.params;

  await prisma.product.update({
    where: { id },
    data: { isActive: false }
  });

  // ✅ امسح كل cache شامل admin
  await Promise.all([
    cacheDel(`product:${id}`),
    cacheDel("products:featured"),
    cacheDelPattern("products:*"),
    cacheDelPattern("admin:products:*"),
     cacheDelPattern("products:list:*") 
  ]);

  return ApiResponse.success(res, null, "Product deleted");
}

// ── Update Stock (Admin) ──────────────────────────
async function updateStock(req, res) {
  const { id } = req.params;
  const { stock } = req.body;

  if (stock === undefined || stock < 0) {
    return ApiResponse.badRequest(res, "Valid stock value required");
  }

  const product = await prisma.product.update({
    where: { id },
    data: { stock: parseInt(stock) },
    select: { id: true, name: true, stock: true },
  });

  await cacheDel(`product:${id}`);
  return ApiResponse.success(res, product, "Stock updated");
}

// ── Toggle Featured (Admin) ───────────────────────
async function toggleFeatured(req, res) {
  const { id } = req.params;

  const current = await prisma.product.findUnique({
    where: { id },
    select: { isFeatured: true },
  });

  if (!current) return ApiResponse.notFound(res, "Product");

  const product = await prisma.product.update({
    where: { id },
    data: { isFeatured: !current.isFeatured },
    select: { id: true, name: true, isFeatured: true },
  });

  await Promise.all([cacheDel(`product:${id}`), cacheDelPattern("products:*")]);
  return ApiResponse.success(res, product, `Product ${product.isFeatured ? "featured" : "unfeatured"}`);
}

// ── Get All Admin Products (includes inactive) ────
async function getAllAdmin(req, res) {
  const {
    page = 1,
    limit = 20,
    category,
    search,
    featured,
    showInactive
  } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // ✅ الإصلاح: اعرض المحذوفة فقط لو showInactive=true صريح
  const where = {};
  if (showInactive !== "true") {
    where.isActive = true;
  }
  if (category) where.category = category;
  if (featured === "true") where.isFeatured = true;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } }
    ];
  }

  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: "desc" }
    }),
    prisma.product.count({ where })
  ]);

  return ApiResponse.paginated(res, products, {
    page: parseInt(page),
    limit: parseInt(limit),
    total
  });
}

module.exports = {
  getAll, getOne, getFeatured, search,
  getReviews, addReview,
  create, update, remove, updateStock,
  toggleFeatured, getAllAdmin,
};
