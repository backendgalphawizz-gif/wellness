const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { hashPassword, comparePassword } = require("../../utils/password");
const { toPublicProfile } = require("../../utils/toPublicProfile");
const { publicUploadPathFromFile } = require("../../utils/publicUploadPath");
const { deleteUploadFileByPublicUrl } = require("../../utils/deleteUploadFile");
const {
  createTokenPair,
  verifyRefreshToken,
} = require("../../utils/jwt");
const {
  createAdmin,
  getAdminByEmail,
  getAdminById,
  updateAdmin,
} = require("../../models/adminModel");
const config = require("../../config");

function sendAuthResponse(res, statusCode, admin) {
  const { accessToken, refreshToken } = createTokenPair({
    sub: admin.id,
    role: "admin",
  });
  return res.status(statusCode).json({
    status: true,
    message: "Authentication successful",
    accessToken,
    refreshToken,
    admin: toPublicProfile(admin),
  });
}

exports.registerAdmin = asyncHandler(async (req, res) => {
  if (!config.adminRegistrationEnabled) {
    throw new AppError("Admin registration is disabled", 403);
  }
  const { name, email, password, phone, profileImage } = req.body;

  if (!name || !email || !password) {
    throw new AppError("Name, email, and password are required", 400);
  }

  const existingAdmin = await getAdminByEmail(email);
  if (existingAdmin) {
    throw new AppError("Admin already exists with this email", 409);
  }

  const passwordHash = await hashPassword(password);
  const admin = await createAdmin({
    name,
    email,
    password: passwordHash,
    phone,
    profileImage,
    status: "active",
  });

  return sendAuthResponse(res, 201, admin);
});

exports.loginAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }

  const admin = await getAdminByEmail(email);
  if (!admin) {
    throw new AppError("Invalid credentials", 401);
  }

  const passwordMatched = await comparePassword(password, admin.password);
  if (!passwordMatched) {
    throw new AppError("Invalid credentials", 401);
  }

  if (admin.status === "inactive") {
    throw new AppError("Account is inactive", 403);
  }

  return sendAuthResponse(res, 200, admin);
});

exports.getAdminProfile = asyncHandler(async (req, res) => {
  const admin = await getAdminById(req.auth?.sub);
  if (!admin) {
    throw new AppError("Admin not found", 404);
  }

  return res.status(200).json({
    status: true,
    message: "Admin profile fetched successfully",
    admin: toPublicProfile(admin),
  });
});

exports.updateAdminProfile = asyncHandler(async (req, res) => {
  const admin = await getAdminById(req.auth?.sub);
  if (!admin) {
    throw new AppError("Admin not found", 404);
  }

  const { name, phone, profileImage, password } = req.body;
  const updates = {};
  const uploadedProfileImage = publicUploadPathFromFile(req, "admin");

  if (name !== undefined) updates.name = String(name).trim();
  if (phone !== undefined) updates.phone = phone ? String(phone).trim() : null;
  if (password !== undefined) updates.password = await hashPassword(password);

  if (uploadedProfileImage) {
    if (admin.profileImage) {
      deleteUploadFileByPublicUrl(admin.profileImage);
    }
    updates.profileImage = uploadedProfileImage;
  } else if (profileImage !== undefined) {
    if ((profileImage === null || profileImage === "") && admin.profileImage) {
      deleteUploadFileByPublicUrl(admin.profileImage);
    }
    updates.profileImage = profileImage || null;
  }

  const updated = await updateAdmin(req.auth.sub, updates);

  return res.status(200).json({
    status: true,
    message: "Admin profile updated successfully",
    admin: toPublicProfile(updated),
  });
});

exports.changeAdminPassword = asyncHandler(async (req, res) => {
  const admin = await getAdminById(req.auth?.sub);
  if (!admin) {
    throw new AppError("Admin not found", 404);
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError("Current password and new password are required", 400);
  }

  if (String(newPassword).length < 8) {
    throw new AppError("New password must be at least 8 characters", 400);
  }

  const isCurrentPasswordValid = await comparePassword(currentPassword, admin.password);
  if (!isCurrentPasswordValid) {
    throw new AppError("Current password is incorrect", 401);
  }

  const isSamePassword = await comparePassword(newPassword, admin.password);
  if (isSamePassword) {
    throw new AppError("New password must be different from current password", 400);
  }

  const password = await hashPassword(newPassword);
  await updateAdmin(req.auth.sub, { password });

  return res.status(200).json({
    status: true,
    message: "Password updated successfully",
  });
});

exports.refreshAdminToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError("Refresh token is required", 400);
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (_error) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  if (payload.role !== "admin") {
    throw new AppError("Forbidden", 403);
  }

  const admin = await getAdminById(payload.sub);
  if (!admin) {
    throw new AppError("Admin not found", 404);
  }

  const tokens = createTokenPair({ sub: admin.id, role: "admin" });

  return res.status(200).json({
    status: true,
    message: "Token refreshed successfully",
    ...tokens,
  });
});
