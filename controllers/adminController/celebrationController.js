const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { deleteUploadFileByPublicUrl } = require("../../utils/deleteUploadFile");
const { publicUploadPathFromFile } = require("../../utils/publicUploadPath");
const {
  createCelebrationBanner,
  getCelebrationBannerById,
  updateCelebrationBanner,
  deleteCelebrationBanner,
  listCelebrationBanners,
} = require("../../models/celebrationBanners");

const ALLOWED_STATUS = ["active", "inactive"];
const ALLOWED_TYPE = ["birthday", "championship"];

exports.listCelebrationBannersController = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, type, search } = req.query;
  const data = await listCelebrationBanners({ page, limit, status, type, search });

  return res.status(200).json({
    status: true,
    celebrationBanners: data.celebrationBanners,
    pagination: data.pagination,
  });
});

exports.getCelebrationBannerByIdController = asyncHandler(async (req, res) => {
  const celebrationBanner = await getCelebrationBannerById(req.params.id);
  if (!celebrationBanner) throw new AppError("Celebration banner not found", 404);

  return res.status(200).json({
    status: true,
    celebrationBanner,
  });
});

exports.createCelebrationBannerController = asyncHandler(async (req, res) => {
  const title = String(req.body.title || "").trim();
  const type = String(req.body.type || "birthday").trim().toLowerCase();
  const status = String(req.body.status || "active").trim().toLowerCase();
  const startDate = req.body.startDate !== undefined ? String(req.body.startDate || "").trim() : "";
  const endDate = req.body.endDate !== undefined ? String(req.body.endDate || "").trim() : "";
  const image = publicUploadPathFromFile(req, "celebration-banners") ?? String(req.body.image || "").trim();

  if (!title) throw new AppError("title is required", 400);
  if (!image) throw new AppError("image is required", 400);
  if (!ALLOWED_TYPE.includes(type)) throw new AppError("type must be birthday or championship", 400);
  if (!ALLOWED_STATUS.includes(status)) throw new AppError("status must be active or inactive", 400);

  const celebrationBanner = await createCelebrationBanner({
    title,
    image,
    type,
    status,
    startDate,
    endDate,
  });

  return res.status(201).json({
    status: true,
    message: "Celebration banner created successfully",
    celebrationBanner,
  });
});

exports.updateCelebrationBannerController = asyncHandler(async (req, res) => {
  const current = await getCelebrationBannerById(req.params.id);
  if (!current) throw new AppError("Celebration banner not found", 404);

  const updates = {};

  if (req.body.title !== undefined) {
    const title = String(req.body.title || "").trim();
    if (!title) throw new AppError("title cannot be empty", 400);
    updates.title = title;
  }

  if (req.body.type !== undefined) {
    const type = String(req.body.type || "").trim().toLowerCase();
    if (!ALLOWED_TYPE.includes(type)) throw new AppError("type must be birthday or championship", 400);
    updates.type = type;
  }

  if (req.body.status !== undefined) {
    const status = String(req.body.status || "").trim().toLowerCase();
    if (!ALLOWED_STATUS.includes(status)) throw new AppError("status must be active or inactive", 400);
    updates.status = status;
  }

  if (req.body.startDate !== undefined) {
    updates.startDate = String(req.body.startDate || "").trim();
  }

  if (req.body.endDate !== undefined) {
    updates.endDate = String(req.body.endDate || "").trim();
  }

  if (req.body.image !== undefined) {
    updates.image = String(req.body.image || "").trim();
  }

  const uploadedImage = publicUploadPathFromFile(req, "celebration-banners");
  if (uploadedImage) {
    if (current.image) deleteUploadFileByPublicUrl(current.image);
    updates.image = uploadedImage;
  }

  if (Object.keys(updates).length === 0) throw new AppError("At least one field is required for update", 400);

  let celebrationBanner;
  try {
    celebrationBanner = await updateCelebrationBanner(req.params.id, updates);
  } catch (err) {
    if (err?.name === "ConditionalCheckFailedException") throw new AppError("Celebration banner not found", 404);
    throw err;
  }

  return res.status(200).json({
    status: true,
    message: "Celebration banner updated successfully",
    celebrationBanner,
  });
});

exports.deleteCelebrationBannerController = asyncHandler(async (req, res) => {
  const current = await getCelebrationBannerById(req.params.id);
  if (!current) throw new AppError("Celebration banner not found", 404);
  if (current.image) deleteUploadFileByPublicUrl(current.image);

  try {
    await deleteCelebrationBanner(req.params.id);
  } catch (err) {
    if (err?.name === "ConditionalCheckFailedException") throw new AppError("Celebration banner not found", 404);
    throw err;
  }

  return res.status(200).json({
    status: true,
    message: "Celebration banner deleted successfully",
  });
});
