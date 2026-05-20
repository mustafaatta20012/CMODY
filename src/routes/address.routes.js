// src/routes/address.routes.js
const router = require("express").Router();
const { authenticate } = require("../middleware/auth.middleware");
const addressController = require("../controllers/address.controller");

router.use(authenticate);

router.get("/", addressController.getAddresses);
router.post("/", addressController.createAddress);
router.put("/:id", addressController.updateAddress);
router.delete("/:id", addressController.deleteAddress);
router.patch("/:id/default", addressController.setDefault);

module.exports = router;
