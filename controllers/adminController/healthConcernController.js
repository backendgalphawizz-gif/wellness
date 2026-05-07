const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { deleteUploadFileByPublicUrl } = require("../../utils/deleteUploadFile");
const { publicUploadPathFromFile } = require("../../utils/publicUploadPath");
const {
  createHealthConcern,
  getHealthConcernById,
  updateHealthConcern,
  deleteHealthConcern,
  listHealthConcerns,
} = require("../../models/healthConcernModel");

exports.listHealthConcernsController = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, search } = req.query;
  const data = await listHealthConcerns({ page, limit, status, search });
  return res.status(200).json({ status: true, healthConcerns: data.healthConcerns, pagination: data.pagination });
});

exports.getHealthConcernByIdController = asyncHandler(async (req, res) => {
  const healthConcern = await getHealthConcernById(req.params.id);
  if (!healthConcern) throw new AppError("Health concern not found", 404);
  return res.status(200).json({ status: true, healthConcern });
});

exports.createHealthConcernController = asyncHandler(async (req, res) => {
  const title = String(req.body.title || "").trim();
  const description = String(req.body.description || "").trim();
  const status = String(req.body.status || "active").trim().toLowerCase();
  const icon = publicUploadPathFromFile(req, "health-concern") ?? String(req.body.icon || "").trim();

  if (!title) throw new AppError("title is required", 400);
  if (!description) throw new AppError("description is required", 400);
  if (!icon) throw new AppError("icon is required", 400);
  if (!["active", "inactive"].includes(status)) throw new AppError("status must be active or inactive", 400);

  const healthConcern = await createHealthConcern({ title, description, icon, status });
  return res.status(201).json({ status: true, message: "Health concern created successfully", healthConcern });
});

exports.updateHealthConcernController = asyncHandler(async (req, res) => {
  const current = await getHealthConcernById(req.params.id);
  if (!current) throw new AppError("Health concern not found", 404);

  const updates = {};
  if (req.body.title !== undefined) {
    const title = String(req.body.title || "").trim();
    if (!title) throw new AppError("title cannot be empty", 400);
    updates.title = title;
  }
  if (req.body.description !== undefined) {
    const description = String(req.body.description || "").trim();
    if (!description) throw new AppError("description cannot be empty", 400);
    updates.description = description;
  }
  if (req.body.status !== undefined) {
    const status = String(req.body.status || "").trim().toLowerCase();
    if (!["active", "inactive"].includes(status)) throw new AppError("status must be active or inactive", 400);
    updates.status = status;
  }
  if (req.body.icon !== undefined) {
    updates.icon = String(req.body.icon || "").trim();
  }

  const uploadedIcon = publicUploadPathFromFile(req, "health-concern");
  if (uploadedIcon) {
    if (current.icon) deleteUploadFileByPublicUrl(current.icon);
    updates.icon = uploadedIcon;
  }

  if (Object.keys(updates).length === 0) throw new AppError("At least one field is required for update", 400);

  let healthConcern;
  try {
    healthConcern = await updateHealthConcern(req.params.id, updates);
  } catch (err) {
    if (err?.name === "ConditionalCheckFailedException") throw new AppError("Health concern not found", 404);
    throw err;
  }
  return res.status(200).json({ status: true, message: "Health concern updated successfully", healthConcern });
});

exports.deleteHealthConcernController = asyncHandler(async (req, res) => {
  const current = await getHealthConcernById(req.params.id);
  if (!current) throw new AppError("Health concern not found", 404);
  if (current.icon) deleteUploadFileByPublicUrl(current.icon);

  try {
    await deleteHealthConcern(req.params.id);
  } catch (err) {
    if (err?.name === "ConditionalCheckFailedException") throw new AppError("Health concern not found", 404);
    throw err;
  }
  return res.status(200).json({ status: true, message: "Health concern deleted successfully" });
});
