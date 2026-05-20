// src/routes/order.routes.js
const router = require("express").Router();
const { authenticate, requireAdmin } = require("../middleware/auth.middleware");
const orderController = require("../controllers/order.controller");

router.use(authenticate);

router.post("/", orderController.createOrder);                    // checkout
router.post("/payment-intent", orderController.createPaymentIntent); // Stripe
router.get("/my", orderController.getMyOrders);                   // customer history
router.get("/my/:id", orderController.getMyOrder);

// Admin
router.get("/", requireAdmin, orderController.getAll);
router.get("/:id", requireAdmin, orderController.getOne);
router.patch("/:id/status", requireAdmin, orderController.updateStatus);

module.exports = router;
