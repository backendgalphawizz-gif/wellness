const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const {
  createVideoTestimonial,
  getVideoTestimonialById,
  updateVideoTestimonial,
  deleteVideoTestimonial,
  listVideoTestimonials,
} = require("../../models/videoTestimonials");

const ALLOWED_TYPE = ["link", "video"];
const ALLOWED_STATUS = ["active", "inactive"];
function publicPathFromUploadedFile(file, folder) {
  if (!file?.filename) return "";
  return `/uploads/${folder}/${file.filename}`;
}

exports.listVideoTestimonialsController = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, type, status, search } = req.query;
  const data = await listVideoTestimonials({ page, limit, type, status, search });

  return res.status(200).json({
    status: true,
    videoTestimonials: data.videoTestimonials,
    pagination: data.pagination,
  });
});

exports.getVideoTestimonialByIdController = asyncHandler(async (req, res) => {
  const videoTestimonial = await getVideoTestimonialById(req.params.id);
  if (!videoTestimonial) throw new AppError("Video testimonial not found", 404);

  return res.status(200).json({
    status: true,
    videoTestimonial,
  });
});

exports.createVideoTestimonialController = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const ytLink = String(req.body.ytLink || "").trim();
  const uploadedProfileImage = req.files?.profileImage?.[0];
  const uploadedVideoFile = req.files?.videoFile?.[0];
  const profile_image = publicPathFromUploadedFile(uploadedProfileImage, "video-testimonials") || String(req.body.profile_image || "").trim();
  const video = publicPathFromUploadedFile(uploadedVideoFile, "video-testimonials") || String(req.body.video || "").trim();
  const type = String(req.body.type || (uploadedVideoFile ? "video" : "link")).trim().toLowerCase();
  const status = String(req.body.status || "active").trim().toLowerCase();

  if (!name) throw new AppError("name is required", 400);
  if (!profile_image) throw new AppError("profile_image is required", 400);
  if (!ALLOWED_TYPE.includes(type)) throw new AppError("type must be link or video", 400);
  if (!ALLOWED_STATUS.includes(status)) throw new AppError("status must be active or inactive", 400);
  if (type === "link" && !ytLink) throw new AppError("ytLink is required when type is link", 400);
  if (type === "video" && !video) throw new AppError("video is required when type is video", 400);

  const videoTestimonial = await createVideoTestimonial({
    name,
    profile_image,
    ytLink,
    video,
    type,
    status,
  });

  return res.status(201).json({
    status: true,
    message: "Video testimonial created successfully",
    videoTestimonial,
  });
});

exports.updateVideoTestimonialController = asyncHandler(async (req, res) => {
  const current = await getVideoTestimonialById(req.params.id);
  if (!current) throw new AppError("Video testimonial not found", 404);

  const updates = {};

  if (req.body.name !== undefined) {
    const name = String(req.body.name || "").trim();
    if (!name) throw new AppError("name cannot be empty", 400);
    updates.name = name;
  }
  if (req.body.type !== undefined) {
    const type = String(req.body.type || "").trim().toLowerCase();
    if (!ALLOWED_TYPE.includes(type)) throw new AppError("type must be link or video", 400);
    updates.type = type;
  }
  if (req.body.status !== undefined) {
    const status = String(req.body.status || "").trim().toLowerCase();
    if (!ALLOWED_STATUS.includes(status)) throw new AppError("status must be active or inactive", 400);
    updates.status = status;
  }
  if (req.body.ytLink !== undefined) {
    updates.ytLink = String(req.body.ytLink || "").trim();
  }
  if (req.body.profile_image !== undefined) {
    updates.profile_image = String(req.body.profile_image || "").trim();
  }
  if (req.body.video !== undefined) {
    updates.video = String(req.body.video || "").trim();
  }
  const uploadedProfileImage = req.files?.profileImage?.[0];
  const uploadedVideoFile = req.files?.videoFile?.[0];
  const uploadedProfileImagePath = publicPathFromUploadedFile(uploadedProfileImage, "video-testimonials");
  const uploadedVideoPath = publicPathFromUploadedFile(uploadedVideoFile, "video-testimonials");
  if (uploadedProfileImagePath) {
    updates.profile_image = uploadedProfileImagePath;
  }
  if (uploadedVideoPath) {
    updates.video = uploadedVideoPath;
    if (updates.type === undefined) {
      updates.type = "video";
    }
  }

  const nextType = updates.type || current.type;
  const nextYtLink = updates.ytLink !== undefined ? updates.ytLink : current.ytLink;
  const nextVideo = updates.video !== undefined ? updates.video : current.video;
  if (nextType === "link" && !String(nextYtLink || "").trim()) {
    throw new AppError("ytLink is required when type is link", 400);
  }
  if (nextType === "video" && !String(nextVideo || "").trim()) {
    throw new AppError("video is required when type is video", 400);
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError("At least one field is required for update", 400);
  }

  let videoTestimonial;
  try {
    videoTestimonial = await updateVideoTestimonial(req.params.id, updates);
  } catch (err) {
    if (err?.name === "ConditionalCheckFailedException") throw new AppError("Video testimonial not found", 404);
    throw err;
  }

  return res.status(200).json({
    status: true,
    message: "Video testimonial updated successfully",
    videoTestimonial,
  });
});

exports.deleteVideoTestimonialController = asyncHandler(async (req, res) => {
  try {
    await deleteVideoTestimonial(req.params.id);
  } catch (err) {
    if (err?.name === "ConditionalCheckFailedException") throw new AppError("Video testimonial not found", 404);
    throw err;
  }

  return res.status(200).json({
    status: true,
    message: "Video testimonial deleted successfully",
  });
});
