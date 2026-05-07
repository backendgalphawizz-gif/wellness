const crypto = require("crypto");
const { DeliveryBoy } = require("../../models");
const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { hashPassword, comparePassword } = require("../../utils/password");
const { signAccessToken } = require("../../utils/jwt");
const { toPublicProfile } = require("../../utils/toPublicProfile");
const { deleteUploadFileByPublicUrl } = require("../../utils/deleteUploadFile");

const DELIVERY_UPLOAD_DIR = "delivery";

function uploadedDeliveryFiles(req) {
  const files = req.files || {};
  return {
    profileImage: files.file?.[0] ? `/uploads/${DELIVERY_UPLOAD_DIR}/${files.file[0].filename}` : undefined,
    drivingLicenseFront: files.drivingLicenseFront?.[0]
      ? `/uploads/${DELIVERY_UPLOAD_DIR}/${files.drivingLicenseFront[0].filename}`
      : undefined,
    drivingLicenseBack: files.drivingLicenseBack?.[0]
      ? `/uploads/${DELIVERY_UPLOAD_DIR}/${files.drivingLicenseBack[0].filename}`
      : undefined,
  };
}

function deleteUploaded(paths = []) {
  const unique = new Set(paths.filter(Boolean));
  unique.forEach((path) => deleteUploadFileByPublicUrl(path));
}

function assertDeliveryBoyCanLogin(deliveryBoy) {
  if (deliveryBoy.status === "blocked") {
    throw new AppError("Account is blocked", 403);
  }
  if (deliveryBoy.status === "inactive") {
    throw new AppError("Account is inactive", 403);
  }
  if (deliveryBoy.approvalStatus === "pending") {
    throw new AppError("Account is pending approval", 403);
  }
  if (deliveryBoy.approvalStatus === "rejected") {
    throw new AppError("Account approval was rejected", 403);
  }
  if (deliveryBoy.approvalStatus === "suspended") {
    throw new AppError("Account approval is suspended", 403);
  }
}

exports.register = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    dob,
    gender,
    fcm_id,
    city,
    address,
    profileImage,
    vehicleRegistrationNumber,
    licenseNumber,
    vehicleType,
    drivingLicenseFront,
    drivingLicenseBack,
    bankAccountName,
    accountNumber,
    bankName,
    branchName,
    ifscCode,
  } = req.body;
  const uploaded = uploadedDeliveryFiles(req);

  if (!name || !email || !password || !phone) {
    deleteUploaded([uploaded.profileImage, uploaded.drivingLicenseFront, uploaded.drivingLicenseBack]);
    throw new AppError("Name, email, password, and phone are required", 400);
  }

  const existing = await DeliveryBoy.findOne({
    email: String(email).toLowerCase(),
  });
  if (existing) {
    deleteUploaded([uploaded.profileImage, uploaded.drivingLicenseFront, uploaded.drivingLicenseBack]);
    throw new AppError("Email is already registered", 409);
  }

  const passwordHash = await hashPassword(password);
  let deliveryBoy;
  try {
    deliveryBoy = await DeliveryBoy.create({
      name,
      email,
      passwordHash,
      phone,
      dob,
      gender,
      fcm_id,
      city: city ?? null,
      address: address ?? null,
      profileImage: uploaded.profileImage ?? profileImage,
      vehicleRegistrationNumber: vehicleRegistrationNumber ?? null,
      licenseNumber,
      vehicleType,
      drivingLicenseFront: uploaded.drivingLicenseFront ?? drivingLicenseFront ?? null,
      drivingLicenseBack: uploaded.drivingLicenseBack ?? drivingLicenseBack ?? null,
      bankAccountName: bankAccountName ?? null,
      accountNumber: accountNumber ?? null,
      bankName: bankName ?? null,
      branchName: branchName ?? null,
      ifscCode: ifscCode ?? null,
      status: "active",
      approvalStatus: "pending",
    });
  } catch (err) {
    deleteUploaded([uploaded.profileImage, uploaded.drivingLicenseFront, uploaded.drivingLicenseBack]);
    throw err;
  }

  const token = signAccessToken({
    sub: deliveryBoy._id.toString(),
    role: "deliveryBoy",
  });

  res.status(201).json({
    message: "Registered successfully",
    user: toPublicProfile(deliveryBoy),
    token,
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }

  const deliveryBoy = await DeliveryBoy.findOne({
    email: String(email).toLowerCase(),
  });
  if (!deliveryBoy) {
    throw new AppError("Invalid email or password", 401);
  }
  if (!deliveryBoy.passwordHash) {
    throw new AppError("Password login is not configured for this account", 401);
  }

  const ok = await comparePassword(password, deliveryBoy.passwordHash);
  if (!ok) {
    throw new AppError("Invalid email or password", 401);
  }

  assertDeliveryBoyCanLogin(deliveryBoy);

  const token = signAccessToken({
    sub: deliveryBoy._id.toString(),
    role: "deliveryBoy",
  });

  res.json({
    message: "Login successful",
    user: toPublicProfile(deliveryBoy),
    token,
  });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    throw new AppError("Email is required", 400);
  }

  const deliveryBoy = await DeliveryBoy.findOne({
    email: String(email).toLowerCase(),
  });
  if (!deliveryBoy) {
    res.json({
      message:
        "If an account exists for that email, password reset instructions have been sent.",
    });
    return;
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  deliveryBoy.resetPasswordToken = resetToken;
  deliveryBoy.resetPasswordExpire = new Date(Date.now() + 60 * 60 * 1000);
  await deliveryBoy.save();

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

  const deliveryBoy = await DeliveryBoy.findOne({
    resetPasswordToken: token,
    resetPasswordExpire: { $gt: new Date() },
  });

  if (!deliveryBoy) {
    throw new AppError("Invalid or expired reset token", 400);
  }

  deliveryBoy.passwordHash = await hashPassword(password);
  deliveryBoy.resetPasswordToken = undefined;
  deliveryBoy.resetPasswordExpire = undefined;
  await deliveryBoy.save();

  res.json({ message: "Password has been reset" });
});

exports.getMe = asyncHandler(async (req, res) => {
  res.json({ user: toPublicProfile(req.user) });
});

exports.updateMe = asyncHandler(async (req, res) => {
  const deliveryBoy = await DeliveryBoy.findById(req.user._id);
  if (!deliveryBoy) {
    throw new AppError("Account not found", 404);
  }

  const {
    name,
    phone,
    dob,
    gender,
    fcm_id,
    city,
    address,
    profileImage,
    vehicleRegistrationNumber,
    licenseNumber,
    vehicleType,
    drivingLicenseFront,
    drivingLicenseBack,
    bankAccountName,
    accountNumber,
    bankName,
    branchName,
    ifscCode,
  } = req.body;
  const uploaded = uploadedDeliveryFiles(req);

  if (uploaded.profileImage) {
    deleteUploadFileByPublicUrl(deliveryBoy.profileImage);
    deliveryBoy.profileImage = uploaded.profileImage;
  } else if (Object.prototype.hasOwnProperty.call(req.body, "profileImage")) {
    if (profileImage === "" || profileImage === null) {
      deleteUploadFileByPublicUrl(deliveryBoy.profileImage);
      deliveryBoy.profileImage = null;
    } else if (profileImage !== deliveryBoy.profileImage) {
      deleteUploadFileByPublicUrl(deliveryBoy.profileImage);
      deliveryBoy.profileImage = profileImage;
    }
  }

  if (name !== undefined) {
    deliveryBoy.name = name;
  }
  if (phone !== undefined) {
    deliveryBoy.phone = phone;
  }
  if (dob !== undefined) {
    deliveryBoy.dob = dob === "" ? null : dob;
  }
  if (gender !== undefined) {
    deliveryBoy.gender = gender;
  }
  if (fcm_id !== undefined) {
    deliveryBoy.fcm_id = fcm_id;
  }
  if (city !== undefined) {
    deliveryBoy.city = city === "" ? null : city;
  }
  if (address !== undefined) {
    deliveryBoy.address = address === "" ? null : address;
  }
  if (vehicleRegistrationNumber !== undefined) {
    deliveryBoy.vehicleRegistrationNumber = vehicleRegistrationNumber === "" ? null : vehicleRegistrationNumber;
  }
  if (licenseNumber !== undefined) {
    deliveryBoy.licenseNumber = licenseNumber === "" ? null : licenseNumber;
  }
  if (vehicleType !== undefined) {
    deliveryBoy.vehicleType = vehicleType === "" ? null : vehicleType;
  }
  if (drivingLicenseFront !== undefined) {
    deliveryBoy.drivingLicenseFront = drivingLicenseFront === "" ? null : drivingLicenseFront;
  }
  if (uploaded.drivingLicenseFront) {
    deleteUploadFileByPublicUrl(deliveryBoy.drivingLicenseFront);
    deliveryBoy.drivingLicenseFront = uploaded.drivingLicenseFront;
  }
  if (drivingLicenseBack !== undefined) {
    deliveryBoy.drivingLicenseBack = drivingLicenseBack === "" ? null : drivingLicenseBack;
  }
  if (uploaded.drivingLicenseBack) {
    deleteUploadFileByPublicUrl(deliveryBoy.drivingLicenseBack);
    deliveryBoy.drivingLicenseBack = uploaded.drivingLicenseBack;
  }
  if (bankAccountName !== undefined) {
    deliveryBoy.bankAccountName = bankAccountName === "" ? null : bankAccountName;
  }
  if (accountNumber !== undefined) {
    deliveryBoy.accountNumber = accountNumber === "" ? null : accountNumber;
  }
  if (bankName !== undefined) {
    deliveryBoy.bankName = bankName === "" ? null : bankName;
  }
  if (branchName !== undefined) {
    deliveryBoy.branchName = branchName === "" ? null : branchName;
  }
  if (ifscCode !== undefined) {
    deliveryBoy.ifscCode = ifscCode === "" ? null : ifscCode;
  }

  await deliveryBoy.save();
  const fresh = await DeliveryBoy.findById(deliveryBoy._id).select(
    "-passwordHash"
  );
  res.json({
    message: "Profile updated",
    user: toPublicProfile(fresh),
  });
});

exports.deleteMe = asyncHandler(async (req, res) => {
  const deliveryBoy = await DeliveryBoy.findById(req.user._id);
  if (!deliveryBoy) {
    throw new AppError("Account not found", 404);
  }
  deleteUploaded([
    deliveryBoy.profileImage,
    deliveryBoy.drivingLicenseFront,
    deliveryBoy.drivingLicenseBack,
  ]);
  await DeliveryBoy.findByIdAndDelete(req.user._id);
  res.json({ message: "Account deleted" });
});
