const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { deleteUploadFileByPublicUrl } = require("../../utils/deleteUploadFile");
const {
  createTransformation,
  getTransformationById,
  updateTransformation,
  deleteTransformation,
  listTransformations,
} = require("../../models/transformationModel");

function imagePath(req, field) {
  const file = req.files?.[field]?.[0];
  return file ? `/uploads/transformation/${file.filename}` : undefined;
}

exports.listTransformationsController = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, search, userId } = req.query;
  const data = await listTransformations({ page, limit, status, search, userId });

  return res.status(200).json({
    status: true,
    transformations: data.transformations,
    pagination: data.pagination,
  });
});

exports.getTransformationByIdController = asyncHandler(async (req, res) => {
  const transformation = await getTransformationById(req.params.id);
  if (!transformation) {
    throw new AppError("Transformation not found", 404);
  }
  return res.status(200).json({ status: true, transformation });
});

exports.createTransformationController = asyncHandler(async (req, res) => {
  const timeTaken = Number(req.body.timeTaken);
  const achievements = String(req.body.achievements || "").trim();
  const description = String(req.body.description || "").trim();
  const status = String(req.body.status || "active").trim().toLowerCase();
  const userId = String(req.body.userId || "").trim();
  const oldImage = imagePath(req, "oldImage") ?? String(req.body.oldImage || "").trim();
  const newImage = imagePath(req, "newImage") ?? String(req.body.newImage || "").trim();

  if (!Number.isFinite(timeTaken) || timeTaken < 0) {
    throw new AppError("timeTaken must be a non-negative number", 400);
  }
  if (!achievements) throw new AppError("achievements is required", 400);
  if (!description) throw new AppError("description is required", 400);
  if (!oldImage || !newImage) throw new AppError("oldImage and newImage are required", 400);
  if (!["active", "inactive"].includes(status)) throw new AppError("status must be active or inactive", 400);

  const transformation = await createTransformation({
    timeTaken,
    achievements,
    oldImage,
    newImage,
    description,
    status,
    userId: userId || undefined,
  });

  return res.status(201).json({
    status: true,
    message: "Transformation created successfully",
    transformation,
  });
});

exports.updateTransformationController = asyncHandler(async (req, res) => {
  const current = await getTransformationById(req.params.id);
  if (!current) throw new AppError("Transformation not found", 404);

  const updates = {};

  if (req.body.timeTaken !== undefined) {
    const timeTaken = Number(req.body.timeTaken);
    if (!Number.isFinite(timeTaken) || timeTaken < 0) {
      throw new AppError("timeTaken must be a non-negative number", 400);
    }
    updates.timeTaken = timeTaken;
  }

  if (req.body.achievements !== undefined) {
    const achievements = String(req.body.achievements || "").trim();
    if (!achievements) throw new AppError("achievements cannot be empty", 400);
    updates.achievements = achievements;
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

  if (req.body.userId !== undefined) {
    const userId = String(req.body.userId || "").trim();
    updates.userId = userId || "";
  }

  if (req.body.oldImage !== undefined) {
    updates.oldImage = String(req.body.oldImage || "").trim();
  }
  if (req.body.newImage !== undefined) {
    updates.newImage = String(req.body.newImage || "").trim();
  }

  const uploadedOldImage = imagePath(req, "oldImage");
  if (uploadedOldImage) {
    deleteUploadFileByPublicUrl(current.oldImage);
    updates.oldImage = uploadedOldImage;
  }

  const uploadedNewImage = imagePath(req, "newImage");
  if (uploadedNewImage) {
    deleteUploadFileByPublicUrl(current.newImage);
    updates.newImage = uploadedNewImage;
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError("At least one field is required for update", 400);
  }

  let transformation;
  try {
    transformation = await updateTransformation(req.params.id, updates);
  } catch (err) {
    if (err?.name === "ConditionalCheckFailedException") {
      throw new AppError("Transformation not found", 404);
    }
    throw err;
  }

  return res.status(200).json({
    status: true,
    message: "Transformation updated successfully",
    transformation,
  });
});

exports.deleteTransformationController = asyncHandler(async (req, res) => {
  const current = await getTransformationById(req.params.id);
  if (!current) throw new AppError("Transformation not found", 404);

  if (current.oldImage) deleteUploadFileByPublicUrl(current.oldImage);
  if (current.newImage) deleteUploadFileByPublicUrl(current.newImage);

  try {
    await deleteTransformation(req.params.id);
  } catch (err) {
    if (err?.name === "ConditionalCheckFailedException") {
      throw new AppError("Transformation not found", 404);
    }
    throw err;
  }

  return res.status(200).json({
    status: true,
    message: "Transformation deleted successfully",
  });
});
