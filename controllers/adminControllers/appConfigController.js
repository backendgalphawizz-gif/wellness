const { AppConfig } = require("../../models");
const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { deleteUploadFileByPublicUrl } = require("../../utils/deleteUploadFile");
const createUploader = require("../../utils/fileUploader");

const upload = createUploader("appconfig");

const parseJSON = (value, fallback) => {
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
};

exports.uploadAppConfigFiles = upload.fields([
  { name: "admin_logo", maxCount: 1 },
  { name: "user_logo", maxCount: 1 },
  { name: "favicon", maxCount: 1 },
]);

exports.getAppConfig = asyncHandler(async (req, res) => {
  const config = await AppConfig.findOne().lean();
  res.json({
    status: true,
    message: "App configuration fetched",
    data: config || null,
  });
});

exports.createAppConfig = asyncHandler(async (req, res) => {
  const existing = await AppConfig.findOne();
  if (existing) {
    throw new AppError("App configuration already exists. Use PATCH /api/admin/misc/app-config to update.", 409);
  }

  const {
    app_name,
    app_email,
    app_mobile,
    app_detail,
    address,
    latitude,
    longitude,
    facebook,
    twitter,
    instagram,
    linkedin,
    app_details,
    app_footer_text,
    payment_methods,
    payment_gateways,
  } = req.body;

  if (!app_name || !app_email || !app_mobile) {
    throw new AppError("app_name, app_email, and app_mobile are required", 400);
  }

  const fileUrl = (field) =>
    req.files?.[field]?.[0] ? `/uploads/appconfig/${req.files[field][0].filename}` : "";

  const doc = await AppConfig.create({
    app_name,
    app_email: String(app_email).trim().toLowerCase(),
    app_mobile,
    app_detail: app_detail ?? "",
    address: address ?? "",
    latitude: latitude ?? "",
    longitude: longitude ?? "",
    facebook: facebook ?? "",
    twitter: twitter ?? "",
    instagram: instagram ?? "",
    linkedin: linkedin ?? "",
    app_details: app_details ?? "",
    app_footer_text: app_footer_text ?? "",
    payment_methods: parseJSON(payment_methods, undefined),
    payment_gateways: parseJSON(payment_gateways, undefined),
    admin_logo: fileUrl("admin_logo"),
    user_logo: fileUrl("user_logo"),
    favicon: fileUrl("favicon"),
  });

  res.status(201).json({
    status: true,
    message: "App configuration created",
    data: doc,
  });
});

exports.updateAppConfig = asyncHandler(async (req, res) => {
  const config = await AppConfig.findOne();
  if (!config) {
    throw new AppError("App configuration not found. Use POST /api/admin/misc/app-config to create.", 404);
  }

  const scalarFields = [
    "app_name",
    "app_email",
    "app_mobile",
    "app_detail",
    "address",
    "latitude",
    "longitude",
    "facebook",
    "twitter",
    "instagram",
    "linkedin",
    "app_details",
    "app_footer_text",
  ];

  for (const field of scalarFields) {
    if (req.body[field] !== undefined) {
      config[field] = field === "app_email" ? String(req.body[field]).trim().toLowerCase() : req.body[field];
    }
  }

  if (req.body.payment_methods !== undefined) {
    config.payment_methods = parseJSON(req.body.payment_methods, config.payment_methods);
  }
  if (req.body.payment_gateways !== undefined) {
    config.payment_gateways = parseJSON(req.body.payment_gateways, config.payment_gateways);
  }

  const assignUploaded = (field) => {
    const file = req.files?.[field]?.[0];
    if (!file) return;
    deleteUploadFileByPublicUrl(config[field]);
    config[field] = `/uploads/appconfig/${file.filename}`;
  };

  assignUploaded("admin_logo");
  assignUploaded("user_logo");
  assignUploaded("favicon");

  await config.save();

  res.json({
    status: true,
    message: "App configuration updated",
    data: config,
  });
});
