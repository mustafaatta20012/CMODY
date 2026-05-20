// src/routes/cart.routes.js
const router = require("express").Router();
const { authenticate } = require("../middleware/auth.middleware");
const cartController = require("../controllers/cart.controller");

// All cart routes require authentication
router.use(authenticate);

router.get("/", cartController.getCart);
router.post("/", cartController.addItem);               // add or update item
router.patch("/:productId", cartController.updateQty);  // change qty
router.delete("/:productId", cartController.removeItem);
router.delete("/", cartController.clearCart);
router.post("/coupon", cartController.applyCoupon);
router.delete("/coupon", cartController.removeCoupon);

module.exports = router;
