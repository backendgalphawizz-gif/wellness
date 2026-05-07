const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const {
  listPages,
  getPageById,
  createPage,
  updatePage,
  deletePage,
  normalizeStatus,
} = require("../../models/staticPageModel");

exports.listPagesController = asyncHandler(async (_req, res) => {
  const rows = await listPages();
  return res.status(200).json({
    status: true,
    data: rows,
  });
});

exports.getPageByIdController = asyncHandler(async (req, res) => {
  const row = await getPageById(req.params.id);
  if (!row) {
    throw new AppError("Page not found", 404);
  }
  return res.status(200).json({
    status: true,
    data: row,
  });
});

exports.createPageController = asyncHandler(async (req, res) => {
  const title = String(req.body.title || "").trim();
  const content = String(req.body.content || "").trim();
  const status = normalizeStatus(req.body.status, "active");
  const slug = req.body.slug !== undefined ? String(req.body.slug || "").trim() : undefined;

  if (title.length < 3) {
    throw new AppError("Title must be at least 3 characters", 400);
  }
  if (!content) {
    throw new AppError("Content is required", 400);
  }

  try {
    const row = await createPage({ title, content, status, slug });
    return res.status(201).json({
      status: true,
      message: "Page created successfully",
      data: row,
    });
  } catch (err) {
    if (err?.code === "DUPLICATE_SLUG") {
      throw new AppError("Slug already exists", 409);
    }
    throw err;
  }
});

exports.updatePageController = asyncHandler(async (req, res) => {
  const updates = {};

  if (req.body.title !== undefined) {
    const title = String(req.body.title || "").trim();
    if (title.length < 3) throw new AppError("Title must be at least 3 characters", 400);
    updates.title = title;
  }

  if (req.body.content !== undefined) {
    const content = String(req.body.content || "").trim();
    if (!content) throw new AppError("Content is required", 400);
    updates.content = content;
  }

  if (req.body.status !== undefined) {
    const status = String(req.body.status || "").toLowerCase().trim();
    if (!["active", "inactive"].includes(status)) {
      throw new AppError("Status must be active or inactive", 400);
    }
    updates.status = status;
  }

  if (req.body.slug !== undefined) {
    updates.slug = String(req.body.slug || "").trim();
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError("At least one field is required for update", 400);
  }

  try {
    const row = await updatePage(req.params.id, updates);
    return res.status(200).json({
      status: true,
      message: "Page updated successfully",
      data: row,
    });
  } catch (err) {
    if (err?.code === "NOT_FOUND") throw new AppError("Page not found", 404);
    if (err?.code === "DUPLICATE_SLUG") throw new AppError("Slug already exists", 409);
    if (err?.code === "INVALID_SLUG") throw new AppError("Slug is invalid", 400);
    throw err;
  }
});

exports.deletePageController = asyncHandler(async (req, res) => {
  try {
    await deletePage(req.params.id);
  } catch (err) {
    if (err?.name === "ConditionalCheckFailedException") {
      throw new AppError("Page not found", 404);
    }
    throw err;
  }

  return res.status(200).json({
    status: true,
    message: "Page deleted successfully",
  });
});
