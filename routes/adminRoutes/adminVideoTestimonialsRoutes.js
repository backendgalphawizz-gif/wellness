const express = require("express");

const { protectAdmin } = require("../../middleware/auth");
const { optionalVideoTestimonialsFiles } = require("../../middleware/authMultipart");
const {
  listVideoTestimonialsController,
  getVideoTestimonialByIdController,
  createVideoTestimonialController,
  updateVideoTestimonialController,
  deleteVideoTestimonialController,
} = require("../../controllers/adminController/videoTestimonialsController");

const router = express.Router();

router.get("/", protectAdmin, listVideoTestimonialsController);
router.get("/:id", protectAdmin, getVideoTestimonialByIdController);
router.post("/", protectAdmin, optionalVideoTestimonialsFiles, createVideoTestimonialController);
router.patch("/:id", protectAdmin, optionalVideoTestimonialsFiles, updateVideoTestimonialController);
router.delete("/:id", protectAdmin, deleteVideoTestimonialController);

module.exports = router;
