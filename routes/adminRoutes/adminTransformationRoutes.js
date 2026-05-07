const express = require("express");

const { protectAdmin } = require("../../middleware/auth");
const { optionalTransformationFiles } = require("../../middleware/authMultipart");
const {
  listTransformationsController,
  getTransformationByIdController,
  createTransformationController,
  updateTransformationController,
  deleteTransformationController,
} = require("../../controllers/adminController/transformationController");

const router = express.Router();

router.get("/", protectAdmin, listTransformationsController);
router.get("/:id", protectAdmin, getTransformationByIdController);
router.post("/", protectAdmin, optionalTransformationFiles, createTransformationController);
router.patch("/:id", protectAdmin, optionalTransformationFiles, updateTransformationController);
router.delete("/:id", protectAdmin, deleteTransformationController);

module.exports = router;
