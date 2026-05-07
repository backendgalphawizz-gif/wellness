const express = require("express");
const authController = require("../../controllers/vendorControllers/authController");
const { protectVendor } = require("../../middleware/auth");
const { optionalVendorFile } = require("../../middleware/authMultipart");

const router = express.Router();

router.post("/register", optionalVendorFile, authController.register);
router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.get("/me", protectVendor, authController.getMe);
router.patch("/me", protectVendor, optionalVendorFile, authController.updateMe);
router.delete("/me", protectVendor, authController.deleteMe);

module.exports = router;
