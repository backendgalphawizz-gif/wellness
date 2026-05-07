const { VenueVendor } = require("../../models");
const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { hashPassword } = require("../../utils/password");
const { toPublicProfile } = require("../../utils/toPublicProfile");
const { deleteUploadFileByPublicUrl } = require("../../utils/deleteUploadFile");
const { assertObjectId } = require("../../utils/assertObjectId");
const { publicUploadPathFromFile } = require("../../utils/publicUploadPath");
const { getPagination, searchFilter } = require("../../utils/listQuery");

const UPLOAD_FOLDER = "venue-vendor";
const REQUIRED_FIELDS = ["name", "email", "phone", "businessName"];

function normalizeRequired(value) {
  return String(value ?? "").trim();
}

function normalizeOptional(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function uploadPathFromFiles(req, field) {
  const file = req.files?.[field]?.[0];
  if (!file) return undefined;
  return `/uploads/${UPLOAD_FOLDER}/${file.filename}`;
}

function uploadedVenueVendorPaths(req) {
  return [
    uploadPathFromFiles(req, "file") ?? publicUploadPathFromFile(req, UPLOAD_FOLDER),
    uploadPathFromFiles(req, "aadhaarCard"),
    uploadPathFromFiles(req, "panCard"),
  ].filter(Boolean);
}

function cleanupUploadedVenueVendorFiles(req) {
  uploadedVenueVendorPaths(req).forEach((u) => deleteUploadFileByPublicUrl(u));
}

exports.listVenueVendors = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status, approvalStatus, search } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (approvalStatus) filter.approvalStatus = approvalStatus;

  const searchOr = searchFilter(search, [
    "name",
    "email",
    "phone",
    "businessName",
    "businessPhone",
    "businessEmail",
    "businessAddress",
    "panNumber",
    "gstNumber",
    "bankName",
    "branchName",
    "accountNumber",
    "ifscCode",
  ]);
  if (searchOr) Object.assign(filter, searchOr);

  const [venueVendors, total] = await Promise.all([
    VenueVendor.find(filter)
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    VenueVendor.countDocuments(filter),
  ]);

  res.json({
    venueVendors: venueVendors.map((v) => toPublicProfile(v)),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  });
});

exports.getVenueVendorById = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const venueVendor = await VenueVendor.findById(req.params.id).select("-passwordHash");
  if (!venueVendor) {
    throw new AppError("Venue vendor not found", 404);
  }
  res.json({ venueVendor: toPublicProfile(venueVendor) });
});

exports.createVenueVendor = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    businessName,
    businessPhone,
    businessEmail,
    businessAddress,
    businessDescription,
    panNumber,
    gstNumber,
    bankName,
    branchName,
    accountType,
    accountNumber,
    ifscCode,
    aadhaarCard,
    panCard,
    fcm_id,
    status,
    approvalStatus,
  } = req.body;

  const payload = {
    name: normalizeRequired(name),
    email: normalizeRequired(email).toLowerCase(),
    password: String(password ?? ""),
    phone: normalizeRequired(phone),
    businessName: normalizeRequired(businessName),
  };

  const missing = REQUIRED_FIELDS.some((k) => !payload[k]);
  if (missing) {
    cleanupUploadedVenueVendorFiles(req);
    throw new AppError("Name, email, phone, and business name are required", 400);
  }

  const existing = await VenueVendor.findOne({ email: payload.email });
  if (existing) {
    cleanupUploadedVenueVendorFiles(req);
    throw new AppError("Email is already in use", 409);
  }

  const existingPhone = await VenueVendor.findOne({ phone: payload.phone });
  if (existingPhone) {
    cleanupUploadedVenueVendorFiles(req);
    throw new AppError("Phone number is already in use", 409);
  }

  const profileImageFromFile =
    uploadPathFromFiles(req, "file") ?? publicUploadPathFromFile(req, UPLOAD_FOLDER);
  const aadhaarCardFromFile = uploadPathFromFiles(req, "aadhaarCard");
  const panCardFromFile = uploadPathFromFiles(req, "panCard");
  const passwordHash = payload.password ? await hashPassword(payload.password) : undefined;

  let venueVendor;
  try {
    venueVendor = await VenueVendor.create({
      name: payload.name,
      email: payload.email,
      ...(passwordHash ? { passwordHash } : {}),
      phone: payload.phone,
      businessName: payload.businessName,
      businessPhone: normalizeOptional(businessPhone),
      businessEmail: normalizeOptional(businessEmail)?.toLowerCase() ?? null,
      businessAddress: normalizeOptional(businessAddress),
      businessDescription: normalizeOptional(businessDescription),
      panNumber: normalizeOptional(panNumber),
      gstNumber: normalizeOptional(gstNumber),
      bankName: normalizeOptional(bankName),
      branchName: normalizeOptional(branchName),
      accountType,
      accountNumber: normalizeOptional(accountNumber),
      ifscCode: normalizeOptional(ifscCode),
      aadhaarCard: aadhaarCardFromFile ?? normalizeOptional(aadhaarCard),
      panCard: panCardFromFile ?? normalizeOptional(panCard),
      profileImage: profileImageFromFile,
      fcm_id: normalizeOptional(fcm_id),
      status: status || "active",
      approvalStatus: approvalStatus || "pending",
    });
  } catch (err) {
    cleanupUploadedVenueVendorFiles(req);
    throw err;
  }

  res.status(201).json({
    message: "Venue vendor created",
    venueVendor: toPublicProfile(await VenueVendor.findById(venueVendor._id)),
  });
});

exports.updateVenueVendor = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const venueVendor = await VenueVendor.findById(req.params.id);
  if (!venueVendor) {
    throw new AppError("Venue vendor not found", 404);
  }

  const {
    name,
    email,
    password,
    phone,
    businessName,
    businessPhone,
    businessEmail,
    businessAddress,
    businessDescription,
    panNumber,
    gstNumber,
    bankName,
    branchName,
    accountType,
    accountNumber,
    ifscCode,
    aadhaarCard,
    panCard,
    profileImage,
    fcm_id,
    status,
    approvalStatus,
  } = req.body;

  if (email !== undefined) {
    const emailNorm = normalizeRequired(email).toLowerCase();
    if (!emailNorm) {
      cleanupUploadedVenueVendorFiles(req);
      throw new AppError("Email cannot be empty", 400);
    }
    const taken = await VenueVendor.findOne({
      email: emailNorm,
      _id: { $ne: venueVendor._id },
    });
    if (taken) {
      cleanupUploadedVenueVendorFiles(req);
      throw new AppError("Email is already in use", 409);
    }
    venueVendor.email = emailNorm;
  }

  if (phone !== undefined) {
    const phoneNorm = normalizeRequired(phone);
    if (!phoneNorm) throw new AppError("Phone cannot be empty", 400);
    const phoneTaken = await VenueVendor.findOne({
      phone: phoneNorm,
      _id: { $ne: venueVendor._id },
    });
    if (phoneTaken) {
      cleanupUploadedVenueVendorFiles(req);
      throw new AppError("Phone number is already in use", 409);
    }
    venueVendor.phone = phoneNorm;
  }

  const profileImageFromFile =
    uploadPathFromFiles(req, "file") ?? publicUploadPathFromFile(req, UPLOAD_FOLDER);
  if (profileImageFromFile) {
    deleteUploadFileByPublicUrl(venueVendor.profileImage);
    venueVendor.profileImage = profileImageFromFile;
  } else if (Object.prototype.hasOwnProperty.call(req.body, "profileImage")) {
    if (profileImage === "" || profileImage === null) {
      deleteUploadFileByPublicUrl(venueVendor.profileImage);
      venueVendor.profileImage = null;
    } else if (profileImage !== venueVendor.profileImage) {
      deleteUploadFileByPublicUrl(venueVendor.profileImage);
      venueVendor.profileImage = normalizeOptional(profileImage);
    }
  }

  if (name !== undefined) {
    const normalized = normalizeRequired(name);
    if (!normalized) throw new AppError("Name cannot be empty", 400);
    venueVendor.name = normalized;
  }
  if (businessName !== undefined) {
    const normalized = normalizeRequired(businessName);
    if (!normalized) throw new AppError("Business name cannot be empty", 400);
    venueVendor.businessName = normalized;
  }
  if (businessPhone !== undefined) venueVendor.businessPhone = normalizeOptional(businessPhone);
  if (businessEmail !== undefined) {
    venueVendor.businessEmail = normalizeOptional(businessEmail)?.toLowerCase() ?? null;
  }
  if (businessAddress !== undefined) venueVendor.businessAddress = normalizeOptional(businessAddress);
  if (businessDescription !== undefined) {
    venueVendor.businessDescription = normalizeOptional(businessDescription);
  }
  if (panNumber !== undefined) venueVendor.panNumber = normalizeOptional(panNumber);
  if (gstNumber !== undefined) venueVendor.gstNumber = normalizeOptional(gstNumber);
  if (bankName !== undefined) venueVendor.bankName = normalizeOptional(bankName);
  if (branchName !== undefined) venueVendor.branchName = normalizeOptional(branchName);
  if (accountType !== undefined) venueVendor.accountType = accountType;
  if (accountNumber !== undefined) venueVendor.accountNumber = normalizeOptional(accountNumber);
  if (ifscCode !== undefined) venueVendor.ifscCode = normalizeOptional(ifscCode);

  const aadhaarCardFromFile = uploadPathFromFiles(req, "aadhaarCard");
  if (aadhaarCardFromFile) {
    deleteUploadFileByPublicUrl(venueVendor.aadhaarCard);
    venueVendor.aadhaarCard = aadhaarCardFromFile;
  } else if (aadhaarCard !== undefined) {
    venueVendor.aadhaarCard = normalizeOptional(aadhaarCard);
  }

  const panCardFromFile = uploadPathFromFiles(req, "panCard");
  if (panCardFromFile) {
    deleteUploadFileByPublicUrl(venueVendor.panCard);
    venueVendor.panCard = panCardFromFile;
  } else if (panCard !== undefined) {
    venueVendor.panCard = normalizeOptional(panCard);
  }

  if (fcm_id !== undefined) venueVendor.fcm_id = normalizeOptional(fcm_id);
  if (status !== undefined) venueVendor.status = status;
  if (approvalStatus !== undefined) venueVendor.approvalStatus = approvalStatus;
  if (password) venueVendor.passwordHash = await hashPassword(password);

  await venueVendor.save();
  res.json({
    message: "Venue vendor updated",
    venueVendor: toPublicProfile(await VenueVendor.findById(venueVendor._id)),
  });
});

exports.deleteVenueVendor = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const venueVendor = await VenueVendor.findById(req.params.id);
  if (!venueVendor) {
    throw new AppError("Venue vendor not found", 404);
  }
  [venueVendor.profileImage, venueVendor.aadhaarCard, venueVendor.panCard].forEach((u) =>
    deleteUploadFileByPublicUrl(u)
  );
  await VenueVendor.findByIdAndDelete(req.params.id);
  res.json({ message: "Venue vendor deleted" });
});
