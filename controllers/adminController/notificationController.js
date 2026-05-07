const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { deleteUploadFileByPublicUrl } = require("../../utils/deleteUploadFile");
const { publicUploadPathFromFile } = require("../../utils/publicUploadPath");
const {
  createNotification,
  getNotificationById,
  updateNotification,
  deleteNotification,
  listNotifications,
  normalizeStatus,
  normalizeAudienceType,
} = require("../../models/notificationModel");

exports.listNotificationsController = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, audienceType, search } = req.query;
  const data = await listNotifications({ page, limit, status, audienceType, search });

  return res.status(200).json({
    status: true,
    notifications: data.notifications,
    pagination: data.pagination,
  });
});

exports.getNotificationByIdController = asyncHandler(async (req, res) => {
  const notification = await getNotificationById(req.params.id);
  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  return res.status(200).json({
    status: true,
    notification,
  });
});

exports.createNotificationController = asyncHandler(async (req, res) => {
  const audienceType = normalizeAudienceType(req.body.audienceType, "");
  const message = String(req.body.message || "").trim();
  const status = normalizeStatus(req.body.status, "active");
  const image = publicUploadPathFromFile(req, "notification") ?? String(req.body.image || "").trim();

  if (!audienceType) {
    throw new AppError("audienceType is required", 400);
  }
  if (!["users", "coaches"].includes(audienceType)) {
    throw new AppError("audienceType must be users or coaches", 400);
  }
  if (!message) {
    throw new AppError("message is required", 400);
  }
  if (message.length > 1000) {
    throw new AppError("message cannot exceed 1000 characters", 400);
  }

  const notification = await createNotification({ audienceType, message, image, status });

  return res.status(201).json({
    status: true,
    message: "Notification created successfully",
    notification,
  });
});

exports.updateNotificationController = asyncHandler(async (req, res) => {
  const current = await getNotificationById(req.params.id);
  if (!current) {
    throw new AppError("Notification not found", 404);
  }

  const updates = {};

  if (req.body.audienceType !== undefined) {
    const audienceType = normalizeAudienceType(req.body.audienceType, "");
    if (!["users", "coaches"].includes(audienceType)) {
      throw new AppError("audienceType must be users or coaches", 400);
    }
    updates.audienceType = audienceType;
  }

  if (req.body.message !== undefined) {
    const message = String(req.body.message).trim();
    if (!message) throw new AppError("message cannot be empty", 400);
    if (message.length > 1000) throw new AppError("message cannot exceed 1000 characters", 400);
    updates.message = message;
  }

  if (req.body.status !== undefined) {
    const status = String(req.body.status).trim().toLowerCase();
    if (!["active", "inactive"].includes(status)) {
      throw new AppError("status must be active or inactive", 400);
    }
    updates.status = status;
  }

  if (req.body.image !== undefined) {
    updates.image = String(req.body.image || "").trim();
  }

  const uploadedImage = publicUploadPathFromFile(req, "notification");
  if (uploadedImage) {
    if (current.image) {
      deleteUploadFileByPublicUrl(current.image);
    }
    updates.image = uploadedImage;
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError("At least one field is required for update", 400);
  }

  let notification;
  try {
    notification = await updateNotification(req.params.id, updates);
  } catch (err) {
    if (err?.name === "ConditionalCheckFailedException") {
      throw new AppError("Notification not found", 404);
    }
    throw err;
  }

  return res.status(200).json({
    status: true,
    message: "Notification updated successfully",
    notification,
  });
});

exports.deleteNotificationController = asyncHandler(async (req, res) => {
  const current = await getNotificationById(req.params.id);
  if (!current) {
    throw new AppError("Notification not found", 404);
  }

  if (current.image) {
    deleteUploadFileByPublicUrl(current.image);
  }

  try {
    await deleteNotification(req.params.id);
  } catch (err) {
    if (err?.name === "ConditionalCheckFailedException") {
      throw new AppError("Notification not found", 404);
    }
    throw err;
  }

  return res.status(200).json({
    status: true,
    message: "Notification deleted successfully",
  });
});
