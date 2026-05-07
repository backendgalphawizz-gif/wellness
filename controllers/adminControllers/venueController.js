const Venue = require("../../models/other/venue");
const Category = require("../../models/other/category");
const SubCategory = require("../../models/other/subCategory");
const Amenity = require("../../models/other/amenities");
const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { assertObjectId } = require("../../utils/assertObjectId");
const { getPagination, searchFilter } = require("../../utils/listQuery");
const { deleteUploadFileByPublicUrl } = require("../../utils/deleteUploadFile");

const ALLOWED_STATUS = new Set(["active", "inactive"]);
const ALLOWED_ROLES = new Set(["Admin", "VenueVendor", "Vendor"]);
const VENUE_UPLOAD_FOLDER = "venue";

function normalizeRequired(value) {
  return String(value ?? "").trim();
}

function normalizeOptional(value) {
  if (value === undefined || value === null) return undefined;
  return String(value).trim();
}

function parsePossiblyJsonArray(value, fieldName) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) throw new Error("not array");
      return parsed;
    } catch {
      throw new AppError(`${fieldName} must be a valid JSON array`, 400);
    }
  }
  throw new AppError(`${fieldName} must be an array`, 400);
}

function getRequestFiles(req) {
  const filesPayload = req?.files;
  if (!filesPayload) return [];
  if (Array.isArray(filesPayload)) return filesPayload;
  if (typeof filesPayload === "object") {
    return Object.values(filesPayload)
      .filter(Array.isArray)
      .flat();
  }
  return [];
}

function getUploadedPublicPaths(req, fieldName) {
  return getRequestFiles(req)
    .filter((file) => file.fieldname === fieldName)
    .map((file) => `/uploads/${VENUE_UPLOAD_FOLDER}/${file.filename}`);
}

async function assertCategoryAndSubCategory(categoryId, subCategoryId) {
  const [category, subCategory] = await Promise.all([
    Category.findById(categoryId).select("_id").lean(),
    SubCategory.findById(subCategoryId).select("_id category").lean(),
  ]);

  if (!category) throw new AppError("Category not found", 404);
  if (!subCategory) throw new AppError("Sub-category not found", 404);
  if (String(subCategory.category) !== String(categoryId)) {
    throw new AppError("Sub-category does not belong to selected category", 400);
  }
}

async function assertAmenitiesExist(amenities) {
  if (!Array.isArray(amenities) || amenities.length === 0) return;

  for (const amenityId of amenities) {
    assertObjectId(amenityId, "Invalid amenity id");
  }

  const rows = await Amenity.find({ _id: { $in: amenities } }).select("_id").lean();
  if (rows.length !== new Set(amenities.map(String)).size) {
    throw new AppError("One or more amenities do not exist", 404);
  }
}

exports.listVenues = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status, role, addedById, category, subCategory, city, search } = req.query;

  const filter = {};
  if (status) {
    const statusValue = normalizeRequired(status);
    if (!ALLOWED_STATUS.has(statusValue)) throw new AppError("Invalid status filter", 400);
    filter.status = statusValue;
  }
  if (role) {
    const roleValue = normalizeRequired(role);
    if (!ALLOWED_ROLES.has(roleValue)) throw new AppError("Invalid role filter", 400);
    filter.role = roleValue;
  }
  if (addedById) {
    assertObjectId(addedById, "Invalid addedById filter");
    filter.addedById = addedById;
  }
  if (category) {
    assertObjectId(category, "Invalid category filter");
    filter.category = category;
  }
  if (subCategory) {
    assertObjectId(subCategory, "Invalid subCategory filter");
    filter.subCategory = subCategory;
  }
  if (city && normalizeRequired(city)) {
    filter.city = new RegExp(`^${normalizeRequired(city).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  }

  const searchOr = searchFilter(search, ["name", "description", "shortDescription", "address", "city"]);
  if (searchOr) Object.assign(filter, searchOr);

  const [venues, total] = await Promise.all([
    Venue.find(filter)
      .populate("category", "name status")
      .populate("subCategory", "name status")
      .populate("amenities", "name icon status")
      .populate("addedById", "name businessName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Venue.countDocuments(filter),
  ]);

  res.json({
    venues,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  });
});

exports.getVenueById = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const venue = await Venue.findById(req.params.id)
    .populate("category", "name status")
    .populate("subCategory", "name status")
    .populate("amenities", "name icon status")
    .populate("addedById", "name businessName")
    .lean();

  if (!venue) throw new AppError("Venue not found", 404);
  res.json({ venue });
});

exports.createVenue = asyncHandler(async (req, res) => {
  const name = normalizeRequired(req.body.name);
  const description = normalizeOptional(req.body.description) || "";
  const shortDescription = normalizeOptional(req.body.shortDescription) || "";
  const category = normalizeRequired(req.body.category);
  const subCategory = normalizeRequired(req.body.subCategory);
  const address = normalizeRequired(req.body.address);
  const city = normalizeOptional(req.body.city) || "";
  const state = normalizeOptional(req.body.state) || "";
  const pincode = normalizeOptional(req.body.pincode) || "";
  const latitude = req.body.latitude === "" || req.body.latitude === undefined ? null : Number(req.body.latitude);
  const longitude = req.body.longitude === "" || req.body.longitude === undefined ? null : Number(req.body.longitude);
  const uploadedThumbnail = getUploadedPublicPaths(req, "thumbnail")[0];
  const uploadedImages = getUploadedPublicPaths(req, "images");
  const thumbnail = normalizeRequired(uploadedThumbnail || req.body.thumbnail);
  const bodyImages = parsePossiblyJsonArray(req.body.images, "images").map((img) => String(img).trim());
  const images = uploadedImages.length ? uploadedImages : bodyImages;
  const amenities = parsePossiblyJsonArray(req.body.amenities, "amenities")
    .map((id) => String(id).trim())
    .filter(Boolean);
  const capacity = Number(req.body.capacity ?? 0);
  const basePrice = Number(req.body.basePrice ?? 0);
  const role = normalizeOptional(req.body.role) || "Admin";
  const addedById = normalizeRequired(req.body.addedById || req.auth?.sub);
  const status = normalizeOptional(req.body.status) || "active";

  if (!name || !category || !subCategory || !address || !thumbnail || !addedById) {
    throw new AppError("Name, category, subCategory, address, thumbnail and addedById are required", 400);
  }
  assertObjectId(category, "Invalid category id");
  assertObjectId(subCategory, "Invalid subCategory id");
  assertObjectId(addedById, "Invalid addedById");
  if (Number.isNaN(capacity) || capacity < 0) throw new AppError("Invalid capacity", 400);
  if (Number.isNaN(basePrice) || basePrice < 0) throw new AppError("Invalid basePrice", 400);
  if (latitude !== null && Number.isNaN(latitude)) throw new AppError("Invalid latitude", 400);
  if (longitude !== null && Number.isNaN(longitude)) throw new AppError("Invalid longitude", 400);
  if (!ALLOWED_ROLES.has(role)) throw new AppError("Invalid role", 400);
  if (!ALLOWED_STATUS.has(status)) throw new AppError("Invalid status", 400);

  await assertCategoryAndSubCategory(category, subCategory);
  await assertAmenitiesExist(amenities);

  const venue = await Venue.create({
    name,
    description,
    shortDescription,
    category,
    subCategory,
    address,
    city,
    state,
    pincode,
    latitude,
    longitude,
    thumbnail,
    images: images.filter(Boolean),
    amenities,
    capacity,
    basePrice,
    role,
    addedById,
    status,
    adminApproved : true,
  });

  const fresh = await Venue.findById(venue._id)
    .populate("category", "name status")
    .populate("subCategory", "name status")
    .populate("amenities", "name icon status")
    .populate("addedById", "name businessName")
    .lean();

  res.status(201).json({ message: "Venue created", venue: fresh });
});

exports.updateVenue = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const venue = await Venue.findById(req.params.id);
  if (!venue) throw new AppError("Venue not found", 404);

  const originalCategory = String(venue.category);
  const originalSubCategory = String(venue.subCategory);
  let nextCategory = originalCategory;
  let nextSubCategory = originalSubCategory;

  if (Object.prototype.hasOwnProperty.call(req.body, "name")) {
    const name = normalizeRequired(req.body.name);
    if (!name) throw new AppError("Name cannot be empty", 400);
    venue.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "description")) {
    venue.description = normalizeOptional(req.body.description) || "";
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "shortDescription")) {
    venue.shortDescription = normalizeOptional(req.body.shortDescription) || "";
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "address")) {
    const address = normalizeRequired(req.body.address);
    if (!address) throw new AppError("Address cannot be empty", 400);
    venue.address = address;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "city")) {
    venue.city = normalizeOptional(req.body.city) || "";
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "state")) {
    venue.state = normalizeOptional(req.body.state) || "";
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "pincode")) {
    venue.pincode = normalizeOptional(req.body.pincode) || "";
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "latitude")) {
    const latitude = req.body.latitude === "" ? null : Number(req.body.latitude);
    if (latitude !== null && Number.isNaN(latitude)) throw new AppError("Invalid latitude", 400);
    venue.latitude = latitude;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "longitude")) {
    const longitude = req.body.longitude === "" ? null : Number(req.body.longitude);
    if (longitude !== null && Number.isNaN(longitude)) throw new AppError("Invalid longitude", 400);
    venue.longitude = longitude;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "category")) {
    const category = normalizeRequired(req.body.category);
    assertObjectId(category, "Invalid category id");
    venue.category = category;
    nextCategory = category;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "subCategory")) {
    const subCategory = normalizeRequired(req.body.subCategory);
    assertObjectId(subCategory, "Invalid subCategory id");
    venue.subCategory = subCategory;
    nextSubCategory = subCategory;
  }

  if (nextCategory !== originalCategory || nextSubCategory !== originalSubCategory) {
    await assertCategoryAndSubCategory(nextCategory, nextSubCategory);
  }

  const uploadedThumbnail = getUploadedPublicPaths(req, "thumbnail")[0];
  const uploadedImages = getUploadedPublicPaths(req, "images");

  if (uploadedThumbnail) {
    deleteUploadFileByPublicUrl(venue.thumbnail);
    venue.thumbnail = uploadedThumbnail;
  } else if (Object.prototype.hasOwnProperty.call(req.body, "thumbnail")) {
    const thumbnail = normalizeRequired(req.body.thumbnail);
    if (!thumbnail) throw new AppError("Thumbnail cannot be empty", 400);
    if (thumbnail !== venue.thumbnail) {
      deleteUploadFileByPublicUrl(venue.thumbnail);
    }
    venue.thumbnail = thumbnail;
  }

  if (uploadedImages.length > 0) {
    for (const oldImage of venue.images || []) deleteUploadFileByPublicUrl(oldImage);
    venue.images = uploadedImages;
  } else if (Object.prototype.hasOwnProperty.call(req.body, "images")) {
    const images = parsePossiblyJsonArray(req.body.images, "images").map((img) => String(img).trim());
    venue.images = images.filter(Boolean);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "amenities")) {
    const amenities = parsePossiblyJsonArray(req.body.amenities, "amenities")
      .map((id) => String(id).trim())
      .filter(Boolean);
    await assertAmenitiesExist(amenities);
    venue.amenities = amenities;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "capacity")) {
    const capacity = Number(req.body.capacity);
    if (Number.isNaN(capacity) || capacity < 0) throw new AppError("Invalid capacity", 400);
    venue.capacity = capacity;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "basePrice")) {
    const basePrice = Number(req.body.basePrice);
    if (Number.isNaN(basePrice) || basePrice < 0) throw new AppError("Invalid basePrice", 400);
    venue.basePrice = basePrice;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "role")) {
    const role = normalizeRequired(req.body.role);
    if (!ALLOWED_ROLES.has(role)) throw new AppError("Invalid role", 400);
    venue.role = role;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "addedById")) {
    const addedById = normalizeRequired(req.body.addedById);
    assertObjectId(addedById, "Invalid addedById");
    venue.addedById = addedById;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "status")) {
    const status = normalizeRequired(req.body.status);
    if (!ALLOWED_STATUS.has(status)) throw new AppError("Invalid status", 400);
    venue.status = status;
  }

  await venue.save();
  const fresh = await Venue.findById(venue._id)
    .populate("category", "name status")
    .populate("subCategory", "name status")
    .populate("amenities", "name icon status")
    .populate("addedById", "name businessName")
    .lean();

  res.json({ message: "Venue updated", venue: fresh });
});

exports.deleteVenue = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const venue = await Venue.findById(req.params.id).select("_id thumbnail images").lean();
  if (!venue) throw new AppError("Venue not found", 404);

  deleteUploadFileByPublicUrl(venue.thumbnail);
  for (const image of venue.images || []) deleteUploadFileByPublicUrl(image);

  await Venue.findByIdAndDelete(venue._id);
  res.json({ message: "Venue deleted" });
});
