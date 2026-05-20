// src/routes/admin.routes.js
const router = require("express").Router();
const adminCtrl  = require("../controllers/admin.controller");
const productCtrl = require("../controllers/product.controller");
const { authenticate, requireAdmin } = require("../middleware/auth.middleware");

// All admin routes require auth + admin role
router.use(authenticate, requireAdmin);

// ── Dashboard ────────────────────────────────────
router.get("/dashboard",  adminCtrl.getDashboard);
router.get("/analytics",  adminCtrl.getAnalytics);
router.get("/audit-log",  adminCtrl.getAuditLog);

// ── Users ────────────────────────────────────────
router.get("/users",                adminCtrl.getUsers);
router.patch("/users/:id/role",     adminCtrl.updateUserRole);
router.delete("/users/:id",         adminCtrl.deleteUser);

// ── Coupons ───────────────────────────────────────
router.get("/coupons",        adminCtrl.getCoupons);
router.post("/coupons",       adminCtrl.createCoupon);
router.patch("/coupons/:id",  adminCtrl.updateCoupon);
router.delete("/coupons/:id", adminCtrl.deleteCoupon);

// ── Admin Products (includes inactive) ───────────
// GET  /api/v1/admin/products           → all products (active + inactive)
// POST /api/v1/admin/products           → create new product
// PATCH /api/v1/admin/products/:id      → update product
// DELETE /api/v1/admin/products/:id     → soft delete product
// PATCH /api/v1/admin/products/:id/featured → toggle featured
// PATCH /api/v1/admin/products/:id/stock    → update stock

router.get("/products",                   productCtrl.getAllAdmin);
router.post("/products",                  productCtrl.create);
router.patch("/products/:id",             productCtrl.update);
router.delete("/products/:id",            productCtrl.remove);
router.patch("/products/:id/featured",    productCtrl.toggleFeatured);
router.patch("/products/:id/stock",       productCtrl.updateStock);

module.exports = router;
