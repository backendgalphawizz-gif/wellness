const express = require("express");
const { protectAdmin } = require("../../middleware/auth");
const { optionalHealthConcernFile } = require("../../middleware/authMultipart");
const healthconcernController = require("../../controllers/adminControllers/healthconcernController");

const router = express.Router();

router.use(protectAdmin);

router.get("/", healthconcernController.listHealthConcerns);
router.get("/:id", healthconcernController.getHealthConcernById);
router.post("/", optionalHealthConcernFile, healthconcernController.createHealthConcern);
router.patch("/:id", optionalHealthConcernFile, healthconcernController.updateHealthConcern);
router.delete("/:id", healthconcernController.deleteHealthConcern);

module.exports = router;
