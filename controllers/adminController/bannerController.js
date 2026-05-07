const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { deleteUploadFileByPublicUrl } = require("../../utils/deleteUploadFile");
const { publicUploadPathFromFile } = require("../../utils/publicUploadPath");
const {
  createBanner,
  getBannerById,
  updateBanner,
  deleteBanner,
  listBanners,
} = require("../../models/bannerModel");

exports.listBannersController = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, search } = req.query;
  const data = await listBanners({ page, limit, status, search });
  return res.status(200).json({ status: true, banners: data.banners, pagination: data.pagination });
});

exports.getBannerByIdController = asyncHandler(async (req, res) => {
  const banner = await getBannerById(req.params.id);
  if (!banner) throw new AppError("Banner not found", 404);
  return res.status(200).json({ status: true, banner });
});

exports.createBannerController = asyncHandler(async (req, res) => {
  const title = String(req.body.title || "").trim();
  const status = String(req.body.status || "active").trim().toLowerCase();
  const image = publicUploadPathFromFile(req, "banner") ?? String(req.body.image || "").trim();

  if (!title) throw new AppError("title is required", 400);
  if (!image) throw new AppError("image is required", 400);
  if (!["active", "inactive"].includes(status)) throw new AppError("status must be active or inactive", 400);

  const banner = await createBanner({ title, image, status });
  return res.status(201).json({ status: true, message: "Banner created successfully", banner });
});

exports.updateBannerController = asyncHandler(async (req, res) => {
  const current = await getBannerById(req.params.id);
  if (!current) throw new AppError("Banner not found", 404);

  const updates = {};
  if (req.body.title !== undefined) {
    const title = String(req.body.title || "").trim();
    if (!title) throw new AppError("title cannot be empty", 400);
    updates.title = title;
  }
  if (req.body.status !== undefined) {
    const status = String(req.body.status || "").trim().toLowerCase();
    if (!["active", "inactive"].includes(status)) throw new AppError("status must be active or inactive", 400);
    updates.status = status;
  }
  if (req.body.image !== undefined) {
    updates.image = String(req.body.image || "").trim();
  }

  const uploadedImage = publicUploadPathFromFile(req, "banner");
  if (uploadedImage) {
    if (current.image) deleteUploadFileByPublicUrl(current.image);
    updates.image = uploadedImage;
  }

  if (Object.keys(updates).length === 0) throw new AppError("At least one field is required for update", 400);

  let banner;
  try {
    banner = await updateBanner(req.params.id, updates);
  } catch (err) {
    if (err?.name === "ConditionalCheckFailedException") throw new AppError("Banner not found", 404);
    throw err;
  }
  return res.status(200).json({ status: true, message: "Banner updated successfully", banner });
});

exports.deleteBannerController = asyncHandler(async (req, res) => {
  const current = await getBannerById(req.params.id);
  if (!current) throw new AppError("Banner not found", 404);
  if (current.image) deleteUploadFileByPublicUrl(current.image);

  try {
    await deleteBanner(req.params.id);
  } catch (err) {
    if (err?.name === "ConditionalCheckFailedException") throw new AppError("Banner not found", 404);
    throw err;
  }

  return res.status(200).json({ status: true, message: "Banner deleted successfully" });
});
