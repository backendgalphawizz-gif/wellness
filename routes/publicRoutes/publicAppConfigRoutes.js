const express = require("express");

const {
  getPublicAppConfig,
} = require("../../controllers/publicController/publicAppConfigController");

const router = express.Router();

router.get("/app-config", getPublicAppConfig);

module.exports = router;
