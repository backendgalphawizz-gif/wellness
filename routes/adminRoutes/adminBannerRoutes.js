const express = require("express");

const { protectAdmin } = require("../../middleware/auth");
const { optionalBannerFile } = require("../../middleware/authMultipart");
const {
  listBannersController,
  getBannerByIdController,
  createBannerController,
  updateBannerController,
  deleteBannerController,
} = require("../../controllers/adminController/bannerController");

const router = express.Router();

router.get("/", protectAdmin, listBannersController);
router.get("/:id", protectAdmin, getBannerByIdController);
router.post("/", protectAdmin, optionalBannerFile, createBannerController);
router.patch("/:id", protectAdmin, optionalBannerFile, updateBannerController);
router.delete("/:id", protectAdmin, deleteBannerController);

module.exports = router;
