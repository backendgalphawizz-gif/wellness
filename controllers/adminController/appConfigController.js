const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { deleteUploadFileByPublicUrl } = require("../../utils/deleteUploadFile");
const createUploader = require("../../utils/fileUploader");
const {
  createAppConfig,
  getAppConfig,
  updateAppConfig,
} = require("../../models/appConfigModel");

const upload = createUploader("appconfig");

function parseJSON(value, fallback) {
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
}

function fileUrl(req, field) {
  const file = req.files?.[field]?.[0];
  return file ? `/uploads/appconfig/${file.filename}` : undefined;
}

exports.uploadAppConfigFiles = upload.fields([
  { name: "admin_logo", maxCount: 1 },
  { name: "user_logo", maxCount: 1 },
  { name: "favicon", maxCount: 1 },
]);

exports.getAppConfigController = asyncHandler(async (_req, res) => {
  const config = await getAppConfig();
  return res.status(200).json({
    status: true,
    message: "App configuration fetched",
    data: config || null,
  });
});

exports.createAppConfigController = asyncHandler(async (req, res) => {
  const existing = await getAppConfig();
  if (existing) {
    throw new AppError(
      "App configuration already exists. Use PATCH /api/admin/app-config to update.",
      409,
    );
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

  const config = await createAppConfig();

  const created = await updateAppConfig({
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
    payment_methods: parseJSON(payment_methods, config.payment_methods),
    payment_gateways: parseJSON(payment_gateways, config.payment_gateways),
    admin_logo: fileUrl(req, "admin_logo") ?? "",
    user_logo: fileUrl(req, "user_logo") ?? "",
    favicon: fileUrl(req, "favicon") ?? "",
  });

  return res.status(201).json({
    status: true,
    message: "App configuration created",
    data: created,
  });
});

exports.updateAppConfigController = asyncHandler(async (req, res) => {
  const config = await getAppConfig();
  if (!config) {
    throw new AppError(
      "App configuration not found. Use POST /api/admin/app-config to create.",
      404,
    );
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

  const updates = {};
  for (const field of scalarFields) {
    if (req.body[field] !== undefined) {
      updates[field] =
        field === "app_email"
          ? String(req.body[field]).trim().toLowerCase()
          : req.body[field];
    }
  }

  if (req.body.payment_methods !== undefined) {
    updates.payment_methods = parseJSON(req.body.payment_methods, config.payment_methods);
  }
  if (req.body.payment_gateways !== undefined) {
    updates.payment_gateways = parseJSON(req.body.payment_gateways, config.payment_gateways);
  }

  const uploadedAdminLogo = fileUrl(req, "admin_logo");
  const uploadedUserLogo = fileUrl(req, "user_logo");
  const uploadedFavicon = fileUrl(req, "favicon");

  if (uploadedAdminLogo) {
    deleteUploadFileByPublicUrl(config.admin_logo);
    updates.admin_logo = uploadedAdminLogo;
  }
  if (uploadedUserLogo) {
    deleteUploadFileByPublicUrl(config.user_logo);
    updates.user_logo = uploadedUserLogo;
  }
  if (uploadedFavicon) {
    deleteUploadFileByPublicUrl(config.favicon);
    updates.favicon = uploadedFavicon;
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError("At least one field is required for update", 400);
  }

  const updated = await updateAppConfig(updates);

  return res.status(200).json({
    status: true,
    message: "App configuration updated",
    data: updated,
  });
});
