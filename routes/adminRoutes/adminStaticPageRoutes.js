const express = require("express");

const { protectAdmin } = require("../../middleware/auth");
const {
  listPagesController,
  getPageByIdController,
  createPageController,
  updatePageController,
  deletePageController,
} = require("../../controllers/adminController/staticPageController");

const router = express.Router();

router.get("/", protectAdmin, listPagesController);
router.get("/:id", protectAdmin, getPageByIdController);
router.post("/", protectAdmin, createPageController);
router.patch("/:id", protectAdmin, updatePageController);
router.delete("/:id", protectAdmin, deletePageController);

module.exports = router;
