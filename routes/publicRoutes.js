const express = require("express");
const publicAppConfigController = require("../controllers/publicControllers/publicAppConfigController");

const router = express.Router();

router.get("/app-config", publicAppConfigController.getPublicAppConfig);

module.exports = router;
