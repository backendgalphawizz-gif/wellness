const HealthConcern = require("../../models/other/healthConcern");
const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { assertObjectId } = require("../../utils/assertObjectId");
const { getPagination, searchFilter } = require("../../utils/listQuery");
const { deleteUploadFileByPublicUrl } = require("../../utils/deleteUploadFile");
const { publicUploadPathFromFile } = require("../../utils/publicUploadPath");

const ALLOWED_STATUS = new Set(["active", "inactive"]);
const UPLOAD_FOLDER = "health-concern";

function normalizeRequired(value) {
  return String(value ?? "").trim();
}

function normalizeOptional(value) {
  if (value === undefined || value === null) return undefined;
  return String(value).trim();
}

exports.listHealthConcerns = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status, search } = req.query;

  const filter = {};
  if (status && String(status).trim()) {
    const normalizedStatus = String(status).trim();
    if (!ALLOWED_STATUS.has(normalizedStatus)) throw new AppError("Invalid status filter", 400);
    filter.status = normalizedStatus;
  }

  const searchOr = searchFilter(search, ["title", "description"]);
  if (searchOr) Object.assign(filter, searchOr);

  const [healthConcerns, total] = await Promise.all([
    HealthConcern.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    HealthConcern.countDocuments(filter),
  ]);

  res.json({
    status: true,
    message: "Health concerns fetched",
    healthConcerns,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  });
});

exports.getHealthConcernById = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const healthConcern = await HealthConcern.findById(req.params.id).lean();
  if (!healthConcern) throw new AppError("Health concern not found", 404);
  res.json({ status: true, message: "Health concern fetched", healthConcern });
});

exports.createHealthConcern = asyncHandler(async (req, res) => {
  const title = normalizeRequired(req.body.title);
  const description = normalizeRequired(req.body.description);
  const iconFromFile = publicUploadPathFromFile(req, UPLOAD_FOLDER);
  const icon = normalizeRequired(iconFromFile ?? req.body.icon);
  const status = normalizeOptional(req.body.status) || "active";

  if (!title || !description || !icon) {
    deleteUploadFileByPublicUrl(iconFromFile);
    throw new AppError("Title, description, and icon are required", 400);
  }
  if (!ALLOWED_STATUS.has(status)) {
    deleteUploadFileByPublicUrl(iconFromFile);
    throw new AppError("Invalid status", 400);
  }

  try {
    const healthConcern = await HealthConcern.create({
      title,
      description,
      icon,
      status,
    });
    res.status(201).json({ status: true, message: "Health concern created", healthConcern });
  } catch (error) {
    deleteUploadFileByPublicUrl(iconFromFile);
    throw error;
  }
});

exports.updateHealthConcern = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const healthConcern = await HealthConcern.findById(req.params.id);
  if (!healthConcern) throw new AppError("Health concern not found", 404);

  if (Object.prototype.hasOwnProperty.call(req.body, "title")) {
    const title = normalizeRequired(req.body.title);
    if (!title) throw new AppError("Title cannot be empty", 400);
    healthConcern.title = title;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "description")) {
    const description = normalizeRequired(req.body.description);
    if (!description) throw new AppError("Description cannot be empty", 400);
    healthConcern.description = description;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "icon")) {
    const icon = normalizeRequired(req.body.icon);
    if (!icon) {
      deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
      throw new AppError("Icon cannot be empty", 400);
    }
    healthConcern.icon = icon;
  }

  if (req.file) {
    const uploadedIcon = publicUploadPathFromFile(req, UPLOAD_FOLDER);
    deleteUploadFileByPublicUrl(healthConcern.icon);
    healthConcern.icon = uploadedIcon;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "status")) {
    const status = normalizeRequired(req.body.status);
    if (!ALLOWED_STATUS.has(status)) {
      deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
      throw new AppError("Invalid status", 400);
    }
    healthConcern.status = status;
  }

  await healthConcern.save();
  res.json({ status: true, message: "Health concern updated", healthConcern });
});

exports.deleteHealthConcern = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const healthConcern = await HealthConcern.findById(req.params.id);
  if (!healthConcern) throw new AppError("Health concern not found", 404);

  deleteUploadFileByPublicUrl(healthConcern.icon);
  await HealthConcern.findByIdAndDelete(healthConcern._id);
  res.json({ status: true, message: "Health concern deleted" });
});
