const { User } = require("../../models");
const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { hashPassword } = require("../../utils/password");
const { toPublicProfile } = require("../../utils/toPublicProfile");
const { deleteUploadFileByPublicUrl } = require("../../utils/deleteUploadFile");
const { assertObjectId } = require("../../utils/assertObjectId");
const { publicUploadPathFromFile } = require("../../utils/publicUploadPath");
const { getPagination, searchFilter } = require("../../utils/listQuery");

const UPLOAD_FOLDER = "user";

const GENDERS = ["male", "female", "other", "boy", "girl", "guess"];
const ALLOWED_STATUS = new Set(["active", "inactive", "blocked"]);

function normalizeRequired(value) {
  return String(value ?? "").trim();
}

function normalizeOptional(value) {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
}

function normalizeEmail(value) {
  const s = String(value ?? "").trim().toLowerCase();
  return s === "" ? null : s;
}

function assertGender(value) {
  if (value === undefined || value === null || value === "") {
    return;
  }
  if (!GENDERS.includes(value)) {
    throw new AppError("Invalid gender", 400);
  }
}

function assertStatus(value, label = "status") {
  if (value === undefined || value === null || value === "") {
    return;
  }
  if (!ALLOWED_STATUS.has(String(value))) {
    throw new AppError(`Invalid ${label}`, 400);
  }
}

function parsePrimaryHealthConcern(value) {
  if (value === undefined) {
    return undefined;
  }
  const s = String(value ?? "").trim();
  if (!s) {
    return null;
  }
  assertObjectId(s, "Invalid primary health concern id");
  return s;
}

/** Multipart sends booleans as strings; avoid Boolean("false") === true. */
function parseBodyBoolean(value, whenMissing = false) {
  if (value === undefined || value === null || value === "") {
    return whenMissing;
  }
  if (value === true || value === false) {
    return value;
  }
  const s = String(value).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
  if (s === "false" || s === "0" || s === "no" || s === "off") return false;
  return whenMissing;
}

exports.listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status, search } = req.query;

  const filter = {};
  if (status && String(status).trim()) {
    const st = String(status).trim();
    if (!ALLOWED_STATUS.has(st)) {
      throw new AppError("Invalid status filter", 400);
    }
    filter.status = st;
  }
  const searchOr = searchFilter(search, [
    "name",
    "email",
    "phone",
    "phoneCountryCode",
    "whatsappPhone",
    "country",
    "state",
    "city",
  ]);
  if (searchOr) {
    Object.assign(filter, searchOr);
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .populate("primaryHealthConcern")
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  res.json({
    status: true,
    message: "Users fetched",
    users: users.map((u) => toPublicProfile(u)),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  });
});

exports.getUserById = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const user = await User.findById(req.params.id).populate("primaryHealthConcern").select("-passwordHash");
  if (!user) {
    throw new AppError("User not found", 404);
  }
  res.json({ status: true, message: "User fetched", user: toPublicProfile(user) });
});

exports.createUser = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    phoneCountryCode,
    phone,
    whatsappSameAsMobile,
    whatsappCountryCode,
    whatsappPhone,
    dob,
    gender,
    country,
    state,
    city,
    primaryHealthConcern,
    termsAccepted,
    termsAcceptedAt,
    fcm_id,
    profileImage,
    status,
  } = req.body;

  const nameNorm = normalizeRequired(name);
  const phoneNorm = normalizeRequired(phone);
  const emailNorm = normalizeEmail(email);
  const phoneCcNorm = normalizeOptional(phoneCountryCode) || "+91";

  if (!nameNorm || !phoneNorm || !emailNorm) {
    deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
    throw new AppError("Name, email, and phone are required", 400);
  }

  assertGender(gender);

  let statusNorm = "active";
  if (status !== undefined && status !== null && String(status).trim()) {
    statusNorm = String(status).trim();
    assertStatus(statusNorm, "status");
  }

  const existingEmail = await User.findOne({ email: emailNorm });
  if (existingEmail) {
    deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
    throw new AppError("Email is already in use", 409);
  }

  const existingPhone = await User.findOne({
    phoneCountryCode: phoneCcNorm,
    phone: phoneNorm,
  });
  if (existingPhone) {
    deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
    throw new AppError("Phone number is already in use", 409);
  }

  const sameWa = parseBodyBoolean(whatsappSameAsMobile, false);
  let waCc = normalizeOptional(whatsappCountryCode);
  let waPhone = normalizeOptional(whatsappPhone);
  if (sameWa) {
    waCc = phoneCcNorm;
    waPhone = phoneNorm;
  }

  const termsOn = parseBodyBoolean(termsAccepted, false);
  if (!termsOn) {
    deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
    throw new AppError("Terms and conditions must be accepted to create a user.", 400);
  }
  const termsAt = termsAcceptedAt ? new Date(termsAcceptedAt) : new Date();
  if (Number.isNaN(termsAt.getTime())) {
    deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
    throw new AppError("Invalid terms acceptance date.", 400);
  }

  const fromFile = publicUploadPathFromFile(req, UPLOAD_FOLDER);
  const passwordNorm = String(password ?? "").trim();
  const passwordHash = passwordNorm ? await hashPassword(passwordNorm) : undefined;
  const phc = parsePrimaryHealthConcern(primaryHealthConcern);
  let user;
  try {
    user = await User.create({
      name: nameNorm,
      email: emailNorm,
      ...(passwordHash ? { passwordHash } : {}),
      phoneCountryCode: phoneCcNorm,
      phone: phoneNorm,
      whatsappSameAsMobile: sameWa,
      whatsappCountryCode: waCc,
      whatsappPhone: waPhone,
      dob: dob === "" || dob === undefined ? undefined : dob,
      ...(gender !== undefined && gender !== "" ? { gender } : {}),
      country: normalizeOptional(country),
      state: normalizeOptional(state),
      city: normalizeOptional(city),
      ...(phc !== undefined ? { primaryHealthConcern: phc } : {}),
      termsAccepted: true,
      termsAcceptedAt: termsAt,
      fcm_id: normalizeOptional(fcm_id),
      status: statusNorm,
      profileImage: fromFile ?? normalizeOptional(profileImage),
    });
  } catch (err) {
    deleteUploadFileByPublicUrl(fromFile);
    throw err;
  }

  res.status(201).json({
    status: true,
    message: "User created",
    user: toPublicProfile(
      await User.findById(user._id).select("-passwordHash")
    ),
  });
});

exports.updateUser = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const {
    name,
    email,
    password,
    phoneCountryCode,
    phone,
    whatsappSameAsMobile,
    whatsappCountryCode,
    whatsappPhone,
    dob,
    gender,
    country,
    state,
    city,
    primaryHealthConcern,
    fcm_id,
    profileImage,
    status,
  } = req.body;

  if (email !== undefined) {
    const emailNorm = normalizeEmail(email);
    if (!emailNorm) {
      deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
      throw new AppError("Email is required", 400);
    }
    const taken = await User.findOne({
      email: emailNorm,
      _id: { $ne: user._id },
    });
    if (taken) {
      deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
      throw new AppError("Email is already in use", 409);
    }
    user.email = emailNorm;
  }

  const nextCc =
    phoneCountryCode !== undefined
      ? normalizeOptional(phoneCountryCode) || "+91"
      : user.phoneCountryCode || "+91";
  const nextPhone =
    phone !== undefined ? normalizeRequired(phone) : user.phone;

  if (phone !== undefined || phoneCountryCode !== undefined) {
    if (!nextPhone) {
      deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
      throw new AppError("Phone is required", 400);
    }
    const existingPhone = await User.findOne({
      phoneCountryCode: nextCc,
      phone: nextPhone,
      _id: { $ne: user._id },
    });
    if (existingPhone) {
      deleteUploadFileByPublicUrl(publicUploadPathFromFile(req, UPLOAD_FOLDER));
      throw new AppError("Phone number is already in use", 409);
    }
    user.phoneCountryCode = nextCc;
    user.phone = nextPhone;
  }

  if (whatsappSameAsMobile !== undefined) {
    user.whatsappSameAsMobile = parseBodyBoolean(whatsappSameAsMobile, false);
  }
  if (user.whatsappSameAsMobile) {
    user.whatsappCountryCode = user.phoneCountryCode || "+91";
    user.whatsappPhone = user.phone;
  } else {
    if (whatsappCountryCode !== undefined) {
      user.whatsappCountryCode = normalizeOptional(whatsappCountryCode);
    }
    if (whatsappPhone !== undefined) {
      user.whatsappPhone = normalizeOptional(whatsappPhone);
    }
  }

  if (req.file) {
    deleteUploadFileByPublicUrl(user.profileImage);
    user.profileImage = publicUploadPathFromFile(req, UPLOAD_FOLDER);
  } else if (Object.prototype.hasOwnProperty.call(req.body, "profileImage")) {
    if (profileImage === "" || profileImage === null) {
      deleteUploadFileByPublicUrl(user.profileImage);
      user.profileImage = null;
    } else if (profileImage !== user.profileImage) {
      deleteUploadFileByPublicUrl(user.profileImage);
      user.profileImage = profileImage;
    }
  }

  if (name !== undefined) {
    user.name = normalizeRequired(name);
    if (!user.name) {
      throw new AppError("Name is required", 400);
    }
  }
  if (dob !== undefined) {
    user.dob = dob === "" ? null : dob;
  }
  if (gender !== undefined) {
    if (gender === "" || gender === null) {
      user.gender = "boy";
    } else {
      assertGender(gender);
      user.gender = gender;
    }
  }
  if (country !== undefined) {
    user.country = normalizeOptional(country);
  }
  if (state !== undefined) {
    user.state = normalizeOptional(state);
  }
  if (city !== undefined) {
    user.city = normalizeOptional(city);
  }
  if (primaryHealthConcern !== undefined) {
    user.primaryHealthConcern = parsePrimaryHealthConcern(primaryHealthConcern);
  }

  if (fcm_id !== undefined) {
    user.fcm_id = normalizeOptional(fcm_id);
  }
  if (status !== undefined) {
    assertStatus(status, "status");
    user.status = String(status).trim();
  }
  if (password) {
    user.passwordHash = await hashPassword(password);
  }

  await user.save();
  res.json({
    status: true,
    message: "User updated",
    user: toPublicProfile(await User.findById(user._id).select("-passwordHash")),
  });
});

exports.deleteUser = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new AppError("User not found", 404);
  }
  deleteUploadFileByPublicUrl(user.profileImage);
  await User.findByIdAndDelete(req.params.id);
  res.json({ status: true, message: "User deleted" });
});
