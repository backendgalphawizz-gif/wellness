const express = require("express");

const { protectAdmin } = require("../../middleware/auth");
const { optionalHealthConcernFile } = require("../../middleware/authMultipart");
const {
  listHealthConcernsController,
  getHealthConcernByIdController,
  createHealthConcernController,
  updateHealthConcernController,
  deleteHealthConcernController,
} = require("../../controllers/adminController/healthConcernController");

const router = express.Router();

router.get("/", protectAdmin, listHealthConcernsController);
router.get("/:id", protectAdmin, getHealthConcernByIdController);
router.post("/", protectAdmin, optionalHealthConcernFile, createHealthConcernController);
router.patch("/:id", protectAdmin, optionalHealthConcernFile, updateHealthConcernController);
router.delete("/:id", protectAdmin, deleteHealthConcernController);

module.exports = router;
