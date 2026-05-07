const express = require("express");
const authController = require("../../controllers/venueVendorController.js/authController");
const { protectVenueVendor } = require("../../middleware/auth");
const { optionalVenueVendorFiles } = require("../../middleware/authMultipart");

const router = express.Router();

router.post("/register", optionalVenueVendorFiles, authController.register);
router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.get("/me", protectVenueVendor, authController.getMe);
router.patch("/me", protectVenueVendor, optionalVenueVendorFiles, authController.updateMe);
router.delete("/me", protectVenueVendor, authController.deleteMe);

module.exports = router;
