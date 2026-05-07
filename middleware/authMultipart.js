const createUploader = require("../utils/fileUploader");

function optionalMultipart(uploadMiddleware) {
  return (req, res, next) => {
    if (req.is("multipart/form-data")) {
      return uploadMiddleware(req, res, next);
    }
    next();
  };
}

const adminUpload = createUploader("admin").single("file");
const bannerUpload = createUploader("banner").single("file");
const celebrationUpload = createUploader("celebration-banners").single("file");
const notificationUpload = createUploader("notification").single("file");
const clientTestimonialsUpload = createUploader("client-testimonials").single("file");
const videoTestimonialsUpload = createUploader("video-testimonials").fields([
  { name: "profileImage", maxCount: 1 },
  { name: "videoFile", maxCount: 1 },
]);
const healthConcernUpload = createUploader("health-concern").single("file");
const transformationUploads = createUploader("transformation").fields([
  { name: "oldImage", maxCount: 1 },
  { name: "newImage", maxCount: 1 },
]);

exports.optionalAdminFile = optionalMultipart(adminUpload);
exports.optionalBannerFile = optionalMultipart(bannerUpload);
exports.optionalCelebrationFile = optionalMultipart(celebrationUpload);
exports.optionalNotificationFile = optionalMultipart(notificationUpload);
exports.optionalClientTestimonialsFile = optionalMultipart(clientTestimonialsUpload);
exports.optionalVideoTestimonialsFiles = optionalMultipart(videoTestimonialsUpload);
exports.optionalHealthConcernFile = optionalMultipart(healthConcernUpload);
exports.optionalTransformationFiles = optionalMultipart(transformationUploads);
