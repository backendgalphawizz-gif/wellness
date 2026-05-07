const express = require("express");
const authController = require("../../controllers/deliveryBoyControllers/authController");
const { protectDeliveryBoy } = require("../../middleware/auth");
const { optionalDeliveryBoyFiles } = require("../../middleware/authMultipart");

const router = express.Router();

router.post("/register", optionalDeliveryBoyFiles, authController.register);
router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.get("/me", protectDeliveryBoy, authController.getMe);
router.patch(
  "/me",
  protectDeliveryBoy,
  optionalDeliveryBoyFiles,
  authController.updateMe
);
router.delete("/me", protectDeliveryBoy, authController.deleteMe);

module.exports = router;
