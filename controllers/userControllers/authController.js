const crypto = require("crypto");
const { User, RegistrationOtp } = require("../../models");
const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { hashPassword, comparePassword } = require("../../utils/password");
const { signAccessToken } = require("../../utils/jwt");
const { toPublicProfile } = require("../../utils/toPublicProfile");
const { deleteUploadFileByPublicUrl } = require("../../utils/deleteUploadFile");
const { assertObjectId } = require("../../utils/assertObjectId");

const USER_UPLOAD_DIR = "user";

const GENDERS = ["male", "female", "other", "boy", "girl", "guess"];

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

/** Multipart / JSON may send booleans as strings. */
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

function profilePathFromFile(req) {
  if (!req.file) {
    return undefined;
  }
  return `/uploads/${USER_UPLOAD_DIR}/${req.file.filename}`;
}

function assertUserCanLogin(user) {
  if (user.status === "blocked") {
    throw new AppError("Account is blocked", 403);
  }
  if (user.status === "inactive") {
    throw new AppError("Account is inactive", 403);
  }
}

const OTP_TTL_MS = 10 * 60 * 1000;

function generateLoginOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

/** Constant-time compare for 6-digit OTP strings. */
function verifyOtp(stored, given) {
  const a = String(stored ?? "");
  const b = String(given ?? "").trim();
  if (!/^\d{6}$/.test(b) || a.length !== b.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

async function verifyAndConsumeRegistrationOtp({ emailNorm, phoneCcNorm, phoneNorm, otp }) {
  const otpNorm = String(otp ?? "").trim();
  if (!/^\d{6}$/.test(otpNorm)) {
    throw new AppError("A valid 6-digit registration code is required.", 400);
  }
  const rec = await RegistrationOtp.findOne({
    email: emailNorm,
    phoneCountryCode: phoneCcNorm,
    phone: phoneNorm,
  });
  if (!rec || !rec.otpExpire || rec.otpExpire <= new Date() || !verifyOtp(rec.otp, otpNorm)) {
    throw new AppError("Invalid or expired registration code.", 400);
  }
  await RegistrationOtp.deleteOne({ _id: rec._id });
}

async function findUserByLoginIdentifier({ email, phone, phoneCountryCode }) {
  const emailNorm = email != null && String(email).trim() !== "" ? normalizeEmail(email) : null;
  const phoneNorm = phone != null && String(phone).trim() !== "" ? normalizeRequired(phone) : "";
  const phoneCcNorm = normalizeOptional(phoneCountryCode) || "+91";

  if (!emailNorm && !phoneNorm) {
    throw new AppError("Email or phone is required", 400);
  }

  if (emailNorm) {
    return User.findOne({ email: emailNorm });
  }
  return User.findOne({ phoneCountryCode: phoneCcNorm, phone: phoneNorm });
}

exports.sendRegisterOtp = asyncHandler(async (req, res) => {
  const { email, phone, phoneCountryCode } = req.body;
  const emailNorm = normalizeEmail(email);
  const phoneNorm = normalizeRequired(phone);
  const phoneCcNorm = normalizeOptional(phoneCountryCode) || "+91";

  if (!emailNorm || !phoneNorm) {
    throw new AppError("Email and phone are required to send a registration code.", 400);
  }

  const existingEmail = await User.findOne({ email: emailNorm });
  if (existingEmail) {
    throw new AppError("Email is already registered", 409);
  }
  const existingPhone = await User.findOne({
    phoneCountryCode: phoneCcNorm,
    phone: phoneNorm,
  });
  if (existingPhone) {
    throw new AppError("Phone number is already registered", 409);
  }

  const otp = generateLoginOtp();
  await RegistrationOtp.findOneAndUpdate(
    { email: emailNorm, phoneCountryCode: phoneCcNorm, phone: phoneNorm },
    {
      $set: {
        otp,
        otpExpire: new Date(Date.now() + OTP_TTL_MS),
      },
      $setOnInsert: {
        email: emailNorm,
        phoneCountryCode: phoneCcNorm,
        phone: phoneNorm,
      },
    },
    { upsert: true, new: true }
  );

  // TODO: deliver via SMS/email instead of response body in production.
  res.json({
    status: true,
    message: "Registration code sent.",
    otp,
  });
});

exports.register = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    phoneCountryCode,
    phone,
    otp,
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
  } = req.body;

  const nameNorm = normalizeRequired(name);
  const emailNorm = normalizeEmail(email);
  const phoneNorm = normalizeRequired(phone);
  const phoneCcNorm = normalizeOptional(phoneCountryCode) || "+91";

  if (!nameNorm || !emailNorm || !phoneNorm) {
    deleteUploadFileByPublicUrl(profilePathFromFile(req));
    throw new AppError("Name, email, and phone are required", 400);
  }

  const passwordNorm = String(password ?? "").trim();
  const passwordHash = passwordNorm ? await hashPassword(passwordNorm) : undefined;

  assertGender(gender);

  const termsOn = parseBodyBoolean(termsAccepted, false);
  if (!termsOn) {
    deleteUploadFileByPublicUrl(profilePathFromFile(req));
    throw new AppError("Terms and conditions must be accepted to register.", 400);
  }
  const termsAt = termsAcceptedAt ? new Date(termsAcceptedAt) : new Date();
  if (Number.isNaN(termsAt.getTime())) {
    deleteUploadFileByPublicUrl(profilePathFromFile(req));
    throw new AppError("Invalid terms acceptance date.", 400);
  }

  const existingEmail = await User.findOne({ email: emailNorm });
  if (existingEmail) {
    deleteUploadFileByPublicUrl(profilePathFromFile(req));
    throw new AppError("Email is already registered", 409);
  }

  const existingPhone = await User.findOne({
    phoneCountryCode: phoneCcNorm,
    phone: phoneNorm,
  });
  if (existingPhone) {
    deleteUploadFileByPublicUrl(profilePathFromFile(req));
    throw new AppError("Phone number is already registered", 409);
  }

  await verifyAndConsumeRegistrationOtp({
    emailNorm,
    phoneCcNorm,
    phoneNorm,
    otp,
  });

  const sameWa = parseBodyBoolean(whatsappSameAsMobile, false);
  let waCc = normalizeOptional(whatsappCountryCode);
  let waPhone = normalizeOptional(whatsappPhone);
  if (sameWa) {
    waCc = phoneCcNorm;
    waPhone = phoneNorm;
  }

  const fromFile = profilePathFromFile(req);
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
      profileImage: fromFile ?? normalizeOptional(profileImage),
    });
  } catch (err) {
    deleteUploadFileByPublicUrl(fromFile);
    throw err;
  }

  const token = signAccessToken({ sub: user._id.toString(), role: "user" });

  res.status(201).json({
    status: true,
    message: "Registered successfully",
    user: toPublicProfile(user),
    token,
  });
});

exports.sendLoginOtp = asyncHandler(async (req, res) => {
  const { email, phone, phoneCountryCode } = req.body;
  const user = await findUserByLoginIdentifier({ email, phone, phoneCountryCode });
  if (!user) {
    throw new AppError("User not found", 400);
  }

  const otp = generateLoginOtp();
  user.otp = otp;
  user.otpExpire = new Date(Date.now() + OTP_TTL_MS);
  await user.save();

  // TODO: send `otp` via SMS (phone) or email provider instead of returning it.
  res.json({
    status: true,
    message: "Login code sent.",
    otp,
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, phone, phoneCountryCode, password, otp } = req.body;

  const user = await findUserByLoginIdentifier({ email, phone, phoneCountryCode });
  if (!user) {
    throw new AppError("Invalid credentials", 401);
  }

  const otpNorm = otp != null && String(otp).trim() !== "" ? String(otp).trim() : "";
  const passwordNorm = String(password ?? "").trim();

  if (otpNorm) {
    if (!user.otp || !user.otpExpire || user.otpExpire <= new Date()) {
      throw new AppError("Invalid or expired login code", 401);
    }
    if (!verifyOtp(user.otp, otpNorm)) {
      throw new AppError("Invalid or expired login code", 401);
    }
    user.otp = undefined;
    user.otpExpire = undefined;
    await user.save();
  } else if (passwordNorm) {
    if (!user.passwordHash) {
      throw new AppError("No password on file. Request a login code instead.", 401);
    }
    const ok = await comparePassword(passwordNorm, user.passwordHash);
    if (!ok) {
      throw new AppError("Invalid credentials", 401);
    }
  } else {
    throw new AppError("Provide a password or a 6-digit login code (OTP).", 400);
  }

  assertUserCanLogin(user);

  const token = signAccessToken({ sub: user._id.toString(), role: "user" });
  const fresh = await User.findById(user._id).select("-passwordHash");

  res.json({
    status: true,
    message: "Login successful",
    user: toPublicProfile(fresh),
    token,
  });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    throw new AppError("Email is required", 400);
  }

  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user) {
    throw new AppError(
      "If an account exists for that email, password reset instructions have been sent.",
      400
    );
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = resetToken;
  user.resetPasswordExpire = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  res.json({
    status: true,
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

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpire: { $gt: new Date() },
  });

  if (!user) {
    throw new AppError("Invalid or expired reset token", 400);
  }

  user.passwordHash = await hashPassword(password);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  res.json({ status: true, message: "Password has been reset" });
});

exports.getMe = asyncHandler(async (req, res) => {
  res.json({ status: true, user: toPublicProfile(req.user) });
});

exports.updateMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError("Account not found", 404);
  }

  const {
    name,
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
  } = req.body;

  if (req.file) {
    deleteUploadFileByPublicUrl(user.profileImage);
    user.profileImage = profilePathFromFile(req);
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

  const nextCc =
    phoneCountryCode !== undefined
      ? normalizeOptional(phoneCountryCode) || "+91"
      : user.phoneCountryCode || "+91";
  const nextPhone = phone !== undefined ? normalizeRequired(phone) : user.phone;

  if (phone !== undefined || phoneCountryCode !== undefined) {
    if (!nextPhone) {
      throw new AppError("Phone is required", 400);
    }
    const existingPhone = await User.findOne({
      phoneCountryCode: nextCc,
      phone: nextPhone,
      _id: { $ne: user._id },
    });
    if (existingPhone) {
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

  // termsAccepted / termsAcceptedAt are set at registration only (same as admin updateUser).

  await user.save();
  const fresh = await User.findById(user._id).select("-passwordHash");
  res.json({
    status: true,
    message: "Profile updated successfully",
    user: toPublicProfile(fresh),
  });
});

exports.deleteMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError("Account not found", 404);
  }
  deleteUploadFileByPublicUrl(user.profileImage);
  await User.findByIdAndDelete(req.user._id);
  res.json({ status: true, message: "Account deleted successfully" });
});
