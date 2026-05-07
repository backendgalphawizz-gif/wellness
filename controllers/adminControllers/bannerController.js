const Banner = require("../../models/other/banner");
const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { assertObjectId } = require("../../utils/assertObjectId");
const { getPagination, searchFilter } = require("../../utils/listQuery");
const { deleteUploadFileByPublicUrl } = require("../../utils/deleteUploadFile");
const { publicUploadPathFromFile } = require("../../utils/publicUploadPath");

const ALLOWED_STATUS = new Set(["active", "inactive"]);
const UPLOAD_FOLDER = "banner";

function normalizeRequired(value) {
  return String(value ?? "").trim();
}

function normalizeOptional(value) {
  if (value === undefined || value === null) return undefined;
  return String(value).trim();
}

exports.listBanners = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status, search } = req.query;

  const filter = {};
  if (status) {
    if (!ALLOWED_STATUS.has(String(status))) throw new AppError("Invalid status filter", 400);
    filter.status = String(status);
  }

  const searchOr = searchFilter(search, ["title"]);
  if (searchOr) Object.assign(filter, searchOr);

  const [banners, total] = await Promise.all([
    Banner.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Banner.countDocuments(filter),
  ]);

  res.json({
    status: true,
    message: "Banners fetched",
    banners,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  });
});

exports.getBannerById = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const banner = await Banner.findById(req.params.id).lean();
  if (!banner) throw new AppError("Banner not found", 404);
  res.json({ status: true, message: "Banner fetched", banner });
});

exports.createBanner = asyncHandler(async (req, res) => {
  const title = normalizeRequired(req.body.title);
  const imageFromFile = publicUploadPathFromFile(req, UPLOAD_FOLDER);
  const image = normalizeRequired(imageFromFile ?? req.body.image);
  const status = normalizeOptional(req.body.status) || "active";

  if (!title || !image) {
    deleteUploadFileByPublicUrl(imageFromFile);
    throw new AppError("Title and image are required", 400);
  }
  if (!ALLOWED_STATUS.has(status)) {
    deleteUploadFileByPublicUrl(imageFromFile);
    throw new AppError("Invalid status", 400);
  }

  try {
    const banner = await Banner.create({
      title,
      image,
      status,
    });

    res.status(201).json({ status: true, message: "Banner created", banner });
  } catch (error) {
    deleteUploadFileByPublicUrl(imageFromFile);
    throw error;
  }
});

exports.updateBanner = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const banner = await Banner.findById(req.params.id);
  if (!banner) throw new AppError("Banner not found", 404);

  if (Object.prototype.hasOwnProperty.call(req.body, "title")) {
    const title = normalizeRequired(req.body.title);
    if (!title) throw new AppError("Title cannot be empty", 400);
    banner.title = title;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "image")) {
    const image = normalizeRequired(req.body.image);
    if (!image) {
      deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
      throw new AppError("Image cannot be empty", 400);
    }
    banner.image = image;
  }

  if (req.file) {
    const uploadedImage = publicUploadPathFromFile(req, UPLOAD_FOLDER);
    deleteUploadFileByPublicUrl(banner.image);
    banner.image = uploadedImage;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "status")) {
    const status = normalizeRequired(req.body.status);
    if (!ALLOWED_STATUS.has(status)) {
      deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
      throw new AppError("Invalid status", 400);
    }
    banner.status = status;
  }

  await banner.save();
  res.json({ status: true, message: "Banner updated", banner });
});

exports.deleteBanner = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const banner = await Banner.findById(req.params.id);
  if (!banner) throw new AppError("Banner not found", 404);

  deleteUploadFileByPublicUrl(banner.image);
  await Banner.findByIdAndDelete(banner._id);
  res.json({ status: true, message: "Banner deleted" });
});
