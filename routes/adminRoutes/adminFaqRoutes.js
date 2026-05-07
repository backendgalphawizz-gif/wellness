const express = require("express");

const { protectAdmin } = require("../../middleware/auth");
const {
  listFaqsController,
  getFaqByIdController,
  createFaqController,
  updateFaqController,
  deleteFaqController,
} = require("../../controllers/adminController/faqController");

const router = express.Router();

router.get("/", protectAdmin, listFaqsController);
router.get("/:id", protectAdmin, getFaqByIdController);
router.post("/", protectAdmin, createFaqController);
router.patch("/:id", protectAdmin, updateFaqController);
router.delete("/:id", protectAdmin, deleteFaqController);

module.exports = router;
