const Notification = require("../../models/other/notification");
const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { assertObjectId } = require("../../utils/assertObjectId");
const { getPagination, searchFilter } = require("../../utils/listQuery");
const { deleteUploadFileByPublicUrl } = require("../../utils/deleteUploadFile");
const { publicUploadPathFromFile } = require("../../utils/publicUploadPath");

const ALLOWED_STATUS = new Set(["active", "inactive"]);
const ALLOWED_AUDIENCE_TYPES = new Set(["users", "coaches"]);
const UPLOAD_FOLDER = "notification";

function normalizeRequired(value) {
  return String(value ?? "").trim();
}

function normalizeOptional(value) {
  if (value === undefined || value === null) return undefined;
  return String(value).trim();
}

exports.listNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status, audienceType, search } = req.query;

  const filter = {};

  if (status && String(status).trim()) {
    const normalizedStatus = String(status).trim();
    if (!ALLOWED_STATUS.has(normalizedStatus)) throw new AppError("Invalid status filter", 400);
    filter.status = normalizedStatus;
  }

  if (audienceType && String(audienceType).trim()) {
    const normalizedAudienceType = String(audienceType).trim();
    if (!ALLOWED_AUDIENCE_TYPES.has(normalizedAudienceType)) {
      throw new AppError("Invalid audience type filter", 400);
    }
    filter.audienceType = normalizedAudienceType;
  }

  const searchOr = searchFilter(search, ["message", "audienceType"]);
  if (searchOr) Object.assign(filter, searchOr);

  const [notifications, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
  ]);

  res.json({
    status: true,
    message: "Notifications fetched",
    notifications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  });
});

exports.getNotificationById = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const notification = await Notification.findById(req.params.id).lean();
  if (!notification) throw new AppError("Notification not found", 404);
  res.json({ status: true, message: "Notification fetched", notification });
});

exports.createNotification = asyncHandler(async (req, res) => {
  const audienceType = normalizeRequired(req.body.audienceType);
  const message = normalizeRequired(req.body.message);
  const imageFromFile = publicUploadPathFromFile(req, UPLOAD_FOLDER);
  const image = normalizeOptional(imageFromFile ?? req.body.image) || "";
  const status = normalizeOptional(req.body.status) || "active";

  if (!audienceType || !message) {
    deleteUploadFileByPublicUrl(imageFromFile);
    throw new AppError("Audience type and message are required", 400);
  }
  if (!ALLOWED_AUDIENCE_TYPES.has(audienceType)) {
    deleteUploadFileByPublicUrl(imageFromFile);
    throw new AppError("Invalid audience type", 400);
  }
  if (!ALLOWED_STATUS.has(status)) {
    deleteUploadFileByPublicUrl(imageFromFile);
    throw new AppError("Invalid status", 400);
  }

  try {
    const notification = await Notification.create({
      audienceType,
      message,
      image,
      status,
      sentAt: new Date(),
    });

    res.status(201).json({ status: true, message: "Notification created", notification });
  } catch (error) {
    deleteUploadFileByPublicUrl(imageFromFile);
    throw error;
  }
});

exports.updateNotification = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const notification = await Notification.findById(req.params.id);
  if (!notification) throw new AppError("Notification not found", 404);

  if (Object.prototype.hasOwnProperty.call(req.body, "audienceType")) {
    const audienceType = normalizeRequired(req.body.audienceType);
    if (!audienceType) throw new AppError("Audience type cannot be empty", 400);
    if (!ALLOWED_AUDIENCE_TYPES.has(audienceType)) throw new AppError("Invalid audience type", 400);
    notification.audienceType = audienceType;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "message")) {
    const message = normalizeRequired(req.body.message);
    if (!message) throw new AppError("Message cannot be empty", 400);
    notification.message = message;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "image")) {
    const image = normalizeOptional(req.body.image) || "";
    notification.image = image;
  }

  if (req.file) {
    const uploadedImage = publicUploadPathFromFile(req, UPLOAD_FOLDER);
    deleteUploadFileByPublicUrl(notification.image);
    notification.image = uploadedImage;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "status")) {
    const status = normalizeRequired(req.body.status);
    if (!ALLOWED_STATUS.has(status)) {
      deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
      throw new AppError("Invalid status", 400);
    }
    notification.status = status;
  }

  await notification.save();
  res.json({ status: true, message: "Notification updated", notification });
});

exports.deleteNotification = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const notification = await Notification.findById(req.params.id);
  if (!notification) throw new AppError("Notification not found", 404);

  deleteUploadFileByPublicUrl(notification.image);
  await Notification.findByIdAndDelete(notification._id);
  res.json({ status: true, message: "Notification deleted" });
});
