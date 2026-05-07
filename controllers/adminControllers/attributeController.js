const AttributeTitle = require("../../models/other/attributeTitle");
const AttributeValue = require("../../models/other/attributeValue");
const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { assertObjectId } = require("../../utils/assertObjectId");
const { getPagination, searchFilter } = require("../../utils/listQuery");

const ALLOWED_STATUS = new Set(["active", "inactive"]);

function normalizeRequired(value) {
  return String(value ?? "").trim();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function assertTitleUnique(title, excludeId) {
  const rx = new RegExp(`^${escapeRegex(title)}$`, "i");
  const filter = { title: rx };
  if (excludeId) filter._id = { $ne: excludeId };
  const exists = await AttributeTitle.findOne(filter).select("_id").lean();
  if (exists) throw new AppError("Attribute title already exists", 409);
}

async function assertValueUnique(attributeTitleId, value, excludeId) {
  const rx = new RegExp(`^${escapeRegex(value)}$`, "i");
  const filter = { attributeTitle: attributeTitleId, value: rx };
  if (excludeId) filter._id = { $ne: excludeId };
  const exists = await AttributeValue.findOne(filter).select("_id").lean();
  if (exists) throw new AppError("Attribute value already exists for this title", 409);
}

exports.listAttributeTitles = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status, search } = req.query;

  const filter = {};
  if (status) {
    if (!ALLOWED_STATUS.has(String(status))) throw new AppError("Invalid status filter", 400);
    filter.status = String(status);
  }

  const searchOr = searchFilter(search, ["title"]);
  if (searchOr) Object.assign(filter, searchOr);

  const [attributeTitles, total] = await Promise.all([
    AttributeTitle.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AttributeTitle.countDocuments(filter),
  ]);

  res.json({
    attributeTitles,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  });
});

exports.getAttributeTitleById = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const attributeTitle = await AttributeTitle.findById(req.params.id).lean();
  if (!attributeTitle) throw new AppError("Attribute title not found", 404);
  res.json({ attributeTitle });
});

exports.createAttributeTitle = asyncHandler(async (req, res) => {
  const title = normalizeRequired(req.body.title);
  const status = normalizeRequired(req.body.status || "active");

  if (!title) throw new AppError("Title is required", 400);
  if (!ALLOWED_STATUS.has(status)) throw new AppError("Invalid status", 400);

  await assertTitleUnique(title);
  const attributeTitle = await AttributeTitle.create({ title, status });
  res.status(201).json({ message: "Attribute title created", attributeTitle });
});

exports.updateAttributeTitle = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const attributeTitle = await AttributeTitle.findById(req.params.id);
  if (!attributeTitle) throw new AppError("Attribute title not found", 404);

  if (Object.prototype.hasOwnProperty.call(req.body, "title")) {
    const title = normalizeRequired(req.body.title);
    if (!title) throw new AppError("Title cannot be empty", 400);
    await assertTitleUnique(title, attributeTitle._id);
    attributeTitle.title = title;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "status")) {
    const status = normalizeRequired(req.body.status);
    if (!ALLOWED_STATUS.has(status)) throw new AppError("Invalid status", 400);
    attributeTitle.status = status;
  }

  await attributeTitle.save();
  res.json({ message: "Attribute title updated", attributeTitle });
});

exports.deleteAttributeTitle = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const attributeTitle = await AttributeTitle.findById(req.params.id);
  if (!attributeTitle) throw new AppError("Attribute title not found", 404);

  const linkedValues = await AttributeValue.countDocuments({ attributeTitle: attributeTitle._id });
  if (linkedValues > 0) {
    throw new AppError("Cannot delete attribute title with existing values", 409);
  }

  await AttributeTitle.findByIdAndDelete(attributeTitle._id);
  res.json({ message: "Attribute title deleted" });
});

exports.listAttributeValues = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status, search, attributeTitle } = req.query;

  const filter = {};
  if (status) {
    if (!ALLOWED_STATUS.has(String(status))) throw new AppError("Invalid status filter", 400);
    filter.status = String(status);
  }
  if (attributeTitle) {
    assertObjectId(attributeTitle);
    filter.attributeTitle = attributeTitle;
  }

  const searchOr = searchFilter(search, ["value"]);
  if (searchOr) Object.assign(filter, searchOr);

  const [attributeValues, total] = await Promise.all([
    AttributeValue.find(filter)
      .populate("attributeTitle", "title status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AttributeValue.countDocuments(filter),
  ]);

  res.json({
    attributeValues,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  });
});

exports.getAttributeValueById = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const attributeValue = await AttributeValue.findById(req.params.id)
    .populate("attributeTitle", "title status")
    .lean();
  if (!attributeValue) throw new AppError("Attribute value not found", 404);
  res.json({ attributeValue });
});

exports.createAttributeValue = asyncHandler(async (req, res) => {
  const attributeTitleId = normalizeRequired(req.body.attributeTitle);
  const value = normalizeRequired(req.body.value);
  const status = normalizeRequired(req.body.status || "active");

  if (!attributeTitleId || !value) {
    throw new AppError("Attribute title and value are required", 400);
  }
  assertObjectId(attributeTitleId);
  if (!ALLOWED_STATUS.has(status)) throw new AppError("Invalid status", 400);

  const titleExists = await AttributeTitle.findById(attributeTitleId).select("_id").lean();
  if (!titleExists) throw new AppError("Attribute title not found", 404);

  await assertValueUnique(attributeTitleId, value);
  const attributeValue = await AttributeValue.create({
    attributeTitle: attributeTitleId,
    value,
    status,
  });

  const fresh = await AttributeValue.findById(attributeValue._id)
    .populate("attributeTitle", "title status")
    .lean();

  res.status(201).json({ message: "Attribute value created", attributeValue: fresh });
});

exports.updateAttributeValue = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const attributeValue = await AttributeValue.findById(req.params.id);
  if (!attributeValue) throw new AppError("Attribute value not found", 404);

  let nextAttributeTitleId = String(attributeValue.attributeTitle);

  if (Object.prototype.hasOwnProperty.call(req.body, "attributeTitle")) {
    const attributeTitleId = normalizeRequired(req.body.attributeTitle);
    if (!attributeTitleId) throw new AppError("Attribute title cannot be empty", 400);
    assertObjectId(attributeTitleId);

    const titleExists = await AttributeTitle.findById(attributeTitleId).select("_id").lean();
    if (!titleExists) throw new AppError("Attribute title not found", 404);

    attributeValue.attributeTitle = attributeTitleId;
    nextAttributeTitleId = attributeTitleId;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "value")) {
    const value = normalizeRequired(req.body.value);
    if (!value) throw new AppError("Value cannot be empty", 400);
    await assertValueUnique(nextAttributeTitleId, value, attributeValue._id);
    attributeValue.value = value;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "status")) {
    const status = normalizeRequired(req.body.status);
    if (!ALLOWED_STATUS.has(status)) throw new AppError("Invalid status", 400);
    attributeValue.status = status;
  }

  await attributeValue.save();
  const fresh = await AttributeValue.findById(attributeValue._id)
    .populate("attributeTitle", "title status")
    .lean();
  res.json({ message: "Attribute value updated", attributeValue: fresh });
});

exports.deleteAttributeValue = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const attributeValue = await AttributeValue.findById(req.params.id);
  if (!attributeValue) throw new AppError("Attribute value not found", 404);

  await AttributeValue.findByIdAndDelete(attributeValue._id);
  res.json({ message: "Attribute value deleted" });
});
