const { AppConfig } = require("../../models");
const { asyncHandler } = require("../../utils/asyncHandler");

/**
 * Shape returned to clients without auth — suitable for storefront / login branding.
 * Omits admin-only assets and all payment gateway credentials.
 */
function toPublicAppConfig(doc) {
  if (!doc) return null;

  const payment_gateways = Array.isArray(doc.payment_gateways)
    ? doc.payment_gateways.map(({ provider, isActive }) => ({ provider, isActive }))
    : [];

  return {
    app_name: doc.app_name,
    app_email: doc.app_email,
    app_mobile: doc.app_mobile,
    app_detail: doc.app_detail ?? "",
    user_logo: doc.user_logo ?? "",
    favicon: doc.favicon ?? "",
    address: doc.address ?? "",
    latitude: doc.latitude ?? "",
    longitude: doc.longitude ?? "",
    facebook: doc.facebook ?? "",
    twitter: doc.twitter ?? "",
    instagram: doc.instagram ?? "",
    linkedin: doc.linkedin ?? "",
    app_details: doc.app_details ?? "",
    app_footer_text: doc.app_footer_text ?? "",
    payment_methods: doc.payment_methods ?? [],
    payment_gateways,
    updatedAt: doc.updatedAt,
  };
}

exports.getPublicAppConfig = asyncHandler(async (req, res) => {
  const config = await AppConfig.findOne().lean();
  res.json({
    status: true,
    message: "Public app configuration fetched",
    data: toPublicAppConfig(config),
  });
});
