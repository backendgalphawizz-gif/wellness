const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const {
  createFaq,
  getFaqById,
  updateFaq,
  deleteFaq,
  listFaqs,
  normalizeStatus,
} = require("../../models/faqModel");

exports.listFaqsController = asyncHandler(async (req, res) => {
  const { page = 1, limit = 200, status, search } = req.query;

  const data = await listFaqs({ page, limit, status, search });

  return res.status(200).json({
    status: true,
    faqs: data.faqs,
    pagination: data.pagination,
  });
});

exports.getFaqByIdController = asyncHandler(async (req, res) => {
  const faq = await getFaqById(req.params.id);
  if (!faq) {
    throw new AppError("FAQ not found", 404);
  }

  return res.status(200).json({
    status: true,
    faq,
  });
});

exports.createFaqController = asyncHandler(async (req, res) => {
  const question = String(req.body.question || "").trim();
  const answer = String(req.body.answer || "").trim();
  const status = normalizeStatus(req.body.status, "active");

  if (!question || !answer) {
    throw new AppError("question and answer are required", 400);
  }

  const faq = await createFaq({ question, answer, status });

  return res.status(201).json({
    status: true,
    message: "FAQ created successfully",
    faq,
  });
});

exports.updateFaqController = asyncHandler(async (req, res) => {
  const updates = {};

  if (req.body.question !== undefined) {
    const question = String(req.body.question).trim();
    if (!question) throw new AppError("question cannot be empty", 400);
    updates.question = question;
  }

  if (req.body.answer !== undefined) {
    const answer = String(req.body.answer).trim();
    if (!answer) throw new AppError("answer cannot be empty", 400);
    updates.answer = answer;
  }

  if (req.body.status !== undefined) {
    const status = String(req.body.status).toLowerCase().trim();
    if (!["active", "inactive"].includes(status)) {
      throw new AppError("status must be active or inactive", 400);
    }
    updates.status = status;
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError("At least one field is required for update", 400);
  }

  let faq;
  try {
    faq = await updateFaq(req.params.id, updates);
  } catch (err) {
    if (err?.name === "ConditionalCheckFailedException") {
      throw new AppError("FAQ not found", 404);
    }
    throw err;
  }

  return res.status(200).json({
    status: true,
    message: "FAQ updated successfully",
    faq,
  });
});

exports.deleteFaqController = asyncHandler(async (req, res) => {
  try {
    await deleteFaq(req.params.id);
  } catch (err) {
    if (err?.name === "ConditionalCheckFailedException") {
      throw new AppError("FAQ not found", 404);
    }
    throw err;
  }

  return res.status(200).json({
    status: true,
    message: "FAQ deleted successfully",
  });
});
