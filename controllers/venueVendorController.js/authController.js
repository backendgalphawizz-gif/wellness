const crypto = require("crypto");
const { VenueVendor } = require("../../models");
const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { hashPassword, comparePassword } = require("../../utils/password");
const { signAccessToken } = require("../../utils/jwt");
const { toPublicProfile } = require("../../utils/toPublicProfile");
const { deleteUploadFileByPublicUrl } = require("../../utils/deleteUploadFile");
const { publicUploadPathFromFile } = require("../../utils/publicUploadPath");

const REQUIRED_FIELDS = ["name", "email", "phone", "businessName"];
const UPLOAD_FOLDER = "venue-vendor";

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

function uploadedPaths(req) {
  return [
    uploadPathFromFiles(req, "file") ?? publicUploadPathFromFile(req, UPLOAD_FOLDER),
    uploadPathFromFiles(req, "aadhaarCard"),
    uploadPathFromFiles(req, "panCard"),
  ].filter(Boolean);
}

function cleanupUploadedFiles(req) {
  uploadedPaths(req).forEach((u) => deleteUploadFileByPublicUrl(u));
}

function assertVenueVendorCanLogin(venueVendor) {
  if (venueVendor.status === "blocked") {
    throw new AppError("Account is blocked", 403);
  }
  if (venueVendor.status === "inactive") {
    throw new AppError("Account is inactive", 403);
  }
  if (venueVendor.approvalStatus === "pending") {
    throw new AppError("Account is pending approval", 403);
  }
  if (venueVendor.approvalStatus === "rejected") {
    throw new AppError("Venue vendor application was rejected", 403);
  }
  if (venueVendor.approvalStatus === "suspended") {
    throw new AppError("Venue vendor account is suspended", 403);
  }
}

exports.register = asyncHandler(async (req, res) => {
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
    cleanupUploadedFiles(req);
    throw new AppError("Name, email, phone, and business name are required", 400);
  }

  const existing = await VenueVendor.findOne({ email: payload.email });
  if (existing) {
    cleanupUploadedFiles(req);
    throw new AppError("Email is already registered", 409);
  }

  const passwordHash = payload.password ? await hashPassword(payload.password) : undefined;
  const profileImageFromFile =
    uploadPathFromFiles(req, "file") ?? publicUploadPathFromFile(req, UPLOAD_FOLDER);
  const aadhaarCardFromFile = uploadPathFromFiles(req, "aadhaarCard");
  const panCardFromFile = uploadPathFromFiles(req, "panCard");

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
      approvalStatus: "pending",
    });
  } catch (err) {
    cleanupUploadedFiles(req);
    throw err;
  }

  const token = signAccessToken({
    sub: venueVendor._id.toString(),
    role: "venueVendor",
  });

  res.status(201).json({
    message: "Registered successfully",
    user: toPublicProfile(venueVendor),
    token,
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }

  const venueVendor = await VenueVendor.findOne({
    email: String(email).toLowerCase(),
  });
  if (!venueVendor || !venueVendor.passwordHash) {
    throw new AppError("Invalid email or password", 401);
  }

  const ok = await comparePassword(password, venueVendor.passwordHash);
  if (!ok) {
    throw new AppError("Invalid email or password", 401);
  }

  assertVenueVendorCanLogin(venueVendor);

  const token = signAccessToken({
    sub: venueVendor._id.toString(),
    role: "venueVendor",
  });

  res.json({
    message: "Login successful",
    user: toPublicProfile(venueVendor),
    token,
  });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    throw new AppError("Email is required", 400);
  }

  const venueVendor = await VenueVendor.findOne({
    email: String(email).toLowerCase(),
  });
  if (!venueVendor) {
    res.json({
      message:
        "If an account exists for that email, password reset instructions have been sent.",
    });
    return;
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  venueVendor.resetPasswordToken = resetToken;
  venueVendor.resetPasswordExpire = new Date(Date.now() + 60 * 60 * 1000);
  await venueVendor.save();

  res.json({
    message:
      "If an account exists for that email, password reset instructions have been sent.",
    resetToken: process.env.NODE_ENV === "development" ? resetToken : undefined,
  });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    throw new AppError("Token and new password are required", 400);
  }

  const venueVendor = await VenueVendor.findOne({
    resetPasswordToken: token,
    resetPasswordExpire: { $gt: new Date() },
  });
  if (!venueVendor) {
    throw new AppError("Invalid or expired reset token", 400);
  }

  venueVendor.passwordHash = await hashPassword(password);
  venueVendor.resetPasswordToken = undefined;
  venueVendor.resetPasswordExpire = undefined;
  await venueVendor.save();

  res.json({ message: "Password has been reset" });
});

exports.getMe = asyncHandler(async (req, res) => {
  res.json({ user: toPublicProfile(req.user) });
});

exports.updateMe = asyncHandler(async (req, res) => {
  const venueVendor = await VenueVendor.findById(req.user._id);
  if (!venueVendor) {
    throw new AppError("Account not found", 404);
  }

  const {
    name,
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
  } = req.body;

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
  if (phone !== undefined) {
    const normalized = normalizeRequired(phone);
    if (!normalized) throw new AppError("Phone cannot be empty", 400);
    venueVendor.phone = normalized;
  }
  if (businessName !== undefined) {
    const normalized = normalizeRequired(businessName);
    if (!normalized) throw new AppError("Business name cannot be empty", 400);
    venueVendor.businessName = normalized;
  }
  if (businessPhone !== undefined) venueVendor.businessPhone = normalizeOptional(businessPhone);
  if (businessEmail !== undefined) {
    venueVendor.businessEmail =
      normalizeOptional(businessEmail)?.toLowerCase() ?? null;
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

  await venueVendor.save();
  res.json({
    message: "Profile updated",
    user: toPublicProfile(await VenueVendor.findById(venueVendor._id)),
  });
});

exports.deleteMe = asyncHandler(async (req, res) => {
  const venueVendor = await VenueVendor.findById(req.user._id);
  if (!venueVendor) {
    throw new AppError("Account not found", 404);
  }
  [venueVendor.profileImage, venueVendor.aadhaarCard, venueVendor.panCard].forEach((u) =>
    deleteUploadFileByPublicUrl(u)
  );
  await VenueVendor.findByIdAndDelete(req.user._id);
  res.json({ message: "Account deleted" });
});
