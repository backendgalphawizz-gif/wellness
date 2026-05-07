const express = require("express");

const { protectAdmin } = require("../../middleware/auth");
const { optionalAdminFile } = require("../../middleware/authMultipart");
const {
  registerAdmin,
  loginAdmin,
  refreshAdminToken,
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
} = require("../../controllers/adminController/authController");

const router = express.Router();

router.post("/register", registerAdmin);
router.post("/login", loginAdmin);
router.post("/refresh-token", refreshAdminToken);

router.get("/me", protectAdmin, getAdminProfile);
router.patch("/me", protectAdmin, optionalAdminFile, updateAdminProfile);
router.patch("/me/password", protectAdmin, changeAdminPassword);

module.exports = router;
