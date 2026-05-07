const { Page } = require("../../models");
const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { assertObjectId } = require("../../utils/assertObjectId");

exports.createPage = asyncHandler(async (req, res) => {
  const page = await Page.create(req.body);
  res.status(201).json({
    status: true,
    message: "Page created",
    data: page,
  });
});

exports.getAllPages = asyncHandler(async (req, res) => {
  const pages = await Page.find().sort({ updatedAt: -1 }).lean();
  res.json({
    status: true,
    message: "Pages fetched",
    total: pages.length,
    data: pages,
  });
});

exports.getPageById = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, "Invalid page id");
  const page = await Page.findById(req.params.id).lean();
  if (!page) {
    throw new AppError("Page not found", 404);
  }
  res.json({ status: true, message: "Page fetched", data: page });
});

exports.getPageBySlug = asyncHandler(async (req, res) => {
  const slug = String(req.params.slug || "").trim().toLowerCase();
  if (!slug) {
    throw new AppError("Slug is required", 400);
  }
  const page = await Page.findOne({ slug }).lean();
  if (!page) {
    throw new AppError("Page not found", 404);
  }
  res.json({ status: true, message: "Page fetched", data: page });
});

exports.updatePage = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, "Invalid page id");
  const page = await Page.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!page) {
    throw new AppError("Page not found", 404);
  }
  res.json({ status: true, message: "Page updated", data: page });
});

exports.deletePage = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id, "Invalid page id");
  const page = await Page.findByIdAndDelete(req.params.id);
  if (!page) {
    throw new AppError("Page not found", 404);
  }
  res.json({ status: true, message: "Page deleted" });
});
