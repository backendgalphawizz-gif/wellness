const express = require("express");

const { protectAdmin } = require("../../middleware/auth");
// const {
//   uploadAppConfigFiles,
//   getAppConfig,
//   createAppConfig,
//   updateAppConfig,
// } = require("../../controllers/adminController/appConfigController");
const appConfigController = require("../../controllers/adminController/appConfigController");

const router = express.Router();

router.get("/", protectAdmin, appConfigController.getAppConfigController);
router.post("/", protectAdmin, appConfigController.uploadAppConfigFiles, appConfigController.createAppConfigController);
router.patch("/", protectAdmin, appConfigController.uploadAppConfigFiles, appConfigController.updateAppConfigController);

module.exports = router;
