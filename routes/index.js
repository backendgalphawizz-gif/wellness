const express = require("express");
const adminAuthRoutes = require("./adminRoutes/adminAuthRoutes");
const adminAppConfigRoutes = require("./adminRoutes/adminAppConfigRoutes");
const adminFaqRoutes = require("./adminRoutes/adminFaqRoutes");
const adminNotificationRoutes = require("./adminRoutes/adminNotificationRoutes");
const adminStaticPageRoutes = require("./adminRoutes/adminStaticPageRoutes");
const adminTransformationRoutes = require("./adminRoutes/adminTransformationRoutes");
const adminBannerRoutes = require("./adminRoutes/adminBannerRoutes");
const adminHealthConcernRoutes = require("./adminRoutes/adminHealthConcernRoutes");
const adminCelebrationRoutes = require("./adminRoutes/adminCelebrationRoutes");
const adminClientTestimonialsRoutes = require("./adminRoutes/adminClientTestimonialsRoutes");
const adminVideoTestimonialsRoutes = require("./adminRoutes/adminVideoTestimonialsRoutes");
const publicAppConfigRoutes = require("./publicRoutes/publicAppConfigRoutes");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ ok: true });
});

router.use("/admin/auth", adminAuthRoutes);
router.use("/admin/app-config", adminAppConfigRoutes);
router.use("/admin/faq", adminFaqRoutes);
router.use("/admin/notifications", adminNotificationRoutes);
router.use("/admin/transformations", adminTransformationRoutes);
router.use("/admin/banners", adminBannerRoutes);
router.use("/admin/celebration-banners", adminCelebrationRoutes);
router.use("/admin/client-testimonials", adminClientTestimonialsRoutes);
router.use("/admin/video-testimonials", adminVideoTestimonialsRoutes);
router.use("/admin/health-concerns", adminHealthConcernRoutes);
router.use("/admin/misc/pages", adminStaticPageRoutes);
router.use("/public", publicAppConfigRoutes);

module.exports = router;
