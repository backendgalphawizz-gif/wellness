const express = require("express");

const { protectAdmin } = require("../../middleware/auth");
const { optionalNotificationFile } = require("../../middleware/authMultipart");
const {
  listNotificationsController,
  getNotificationByIdController,
  createNotificationController,
  updateNotificationController,
  deleteNotificationController,
} = require("../../controllers/adminController/notificationController");

const router = express.Router();

router.get("/", protectAdmin, listNotificationsController);
router.get("/:id", protectAdmin, getNotificationByIdController);
router.post("/", protectAdmin, optionalNotificationFile, createNotificationController);
router.patch("/:id", protectAdmin, optionalNotificationFile, updateNotificationController);
router.delete("/:id", protectAdmin, deleteNotificationController);

module.exports = router;
