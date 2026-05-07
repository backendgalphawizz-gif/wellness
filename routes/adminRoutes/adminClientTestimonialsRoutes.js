const express = require("express");

const { protectAdmin } = require("../../middleware/auth");
const { optionalClientTestimonialsFile } = require("../../middleware/authMultipart");
const {
  listClientTestimonialsController,
  getClientTestimonialByIdController,
  createClientTestimonialController,
  updateClientTestimonialController,
  deleteClientTestimonialController,
} = require("../../controllers/adminController/clientTestimonialsController");

const router = express.Router();

router.get("/", protectAdmin, listClientTestimonialsController);
router.get("/:id", protectAdmin, getClientTestimonialByIdController);
router.post("/", protectAdmin, optionalClientTestimonialsFile, createClientTestimonialController);
router.patch("/:id", protectAdmin, optionalClientTestimonialsFile, updateClientTestimonialController);
router.delete("/:id", protectAdmin, deleteClientTestimonialController);

module.exports = router;
