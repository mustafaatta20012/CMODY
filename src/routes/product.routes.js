// src/routes/product.routes.js
const router = require("express").Router();
const ctrl = require("../controllers/product.controller");
const { authenticate, requireAdmin } = require("../middleware/auth.middleware");

// ── Public Routes ────────────────────────────────
router.get("/",           ctrl.getAll);
router.get("/featured",   ctrl.getFeatured);
router.get("/search",     ctrl.search);
router.get("/:id",        ctrl.getOne);
router.get("/:id/reviews", ctrl.getReviews);

// ── Auth Required ────────────────────────────────
router.post("/:id/reviews", authenticate, ctrl.addReview);

// ── Admin Only ───────────────────────────────────
router.post(   "/",          authenticate, requireAdmin, ctrl.create);
router.patch(  "/:id",       authenticate, requireAdmin, ctrl.update);
router.delete( "/:id",       authenticate, requireAdmin, ctrl.remove);
router.patch(  "/:id/stock", authenticate, requireAdmin, ctrl.updateStock);
router.patch(  "/:id/featured", authenticate, requireAdmin, ctrl.toggleFeatured);

module.exports = router;
