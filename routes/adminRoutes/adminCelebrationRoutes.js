const express = require("express");

const { protectAdmin } = require("../../middleware/auth");
const { optionalCelebrationFile } = require("../../middleware/authMultipart");
const {
  listCelebrationBannersController,
  getCelebrationBannerByIdController,
  createCelebrationBannerController,
  updateCelebrationBannerController,
  deleteCelebrationBannerController,
} = require("../../controllers/adminController/celebrationController");

const router = express.Router();

router.get("/", protectAdmin, listCelebrationBannersController);
router.get("/:id", protectAdmin, getCelebrationBannerByIdController);
router.post("/", protectAdmin, optionalCelebrationFile, createCelebrationBannerController);
router.patch("/:id", protectAdmin, optionalCelebrationFile, updateCelebrationBannerController);
router.delete("/:id", protectAdmin, deleteCelebrationBannerController);

module.exports = router;
