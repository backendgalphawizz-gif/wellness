const Banner = require("../../models/other/banner");
const Faq = require("../../models/other/faq");
const HealthConcern = require("../../models/other/healthConcern");
const { Page } = require("../../models");
const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");

exports.getActiveBanners = asyncHandler(async (req, res) => {
  const banners = await Banner.find({ status: "active" }).sort({ createdAt: -1 }).lean();
  res.json({
    status: true,
    message: "Active banners",
    banners,
  });
});

exports.getActiveStaticPages = asyncHandler(async (req, res) => {
  const pages = await Page.find({ status: "active" }).sort({ title: 1 }).lean();
  res.json({
    status: true,
    message: "Active pages",
    pages,
  });
});

exports.getActivePageBySlug = asyncHandler(async (req, res) => {
  const slug = String(req.params.slug || "").trim().toLowerCase();
  if (!slug) {
    throw new AppError("Slug is required", 400);
  }
  const page = await Page.findOne({ slug, status: "active" }).lean();
  if (!page) {
    throw new AppError("Page not found", 404);
  }
  res.json({
    status: true,
    message: "Page fetched",
    page,
  });
});

exports.getActiveFaqs = asyncHandler(async (req, res) => {
  const faqs = await Faq.find({ status: "active" }).sort({ createdAt: 1 }).lean();
  res.json({
    status: true,
    message: "Active FAQs",
    faqs,
  });
});

exports.getActiveHealthConcerns = asyncHandler(async (req, res) => {
  const healthConcerns = await HealthConcern.find({ status: "active" }).sort({ title: 1 }).lean();
  res.json({
    status: true,
    message: "Active health concerns",
    healthConcerns,
  });
});