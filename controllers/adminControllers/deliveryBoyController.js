const { DeliveryBoy } = require("../../models");
const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { hashPassword } = require("../../utils/password");
const { toPublicProfile } = require("../../utils/toPublicProfile");
const { deleteUploadFileByPublicUrl } = require("../../utils/deleteUploadFile");
const { assertObjectId } = require("../../utils/assertObjectId");
const { publicUploadPathFromFile } = require("../../utils/publicUploadPath");
const { getPagination, searchFilter } = require("../../utils/listQuery");

const UPLOAD_FOLDER = "delivery";
const ALLOWED_STATUS = new Set(["active", "inactive", "blocked"]);
const ALLOWED_APPROVAL_STATUS = new Set(["pending", "approved", "rejected", "suspended"]);

function uploadedDeliveryFiles(req) {
  const files = req.files || {};
  return {
    profileImage: files.file?.[0] ? `/uploads/${UPLOAD_FOLDER}/${files.file[0].filename}` : publicUploadPathFromFile(req, UPLOAD_FOLDER),
    drivingLicenseFront: files.drivingLicenseFront?.[0]
      ? `/uploads/${UPLOAD_FOLDER}/${files.drivingLicenseFront[0].filename}`
      : undefined,
    drivingLicenseBack: files.drivingLicenseBack?.[0]
      ? `/uploads/${UPLOAD_FOLDER}/${files.drivingLicenseBack[0].filename}`
      : undefined,
  };
}

function deleteUploaded(paths = []) {
  const unique = new Set(paths.filter(Boolean));
  unique.forEach((path) => deleteUploadFileByPublicUrl(path));
}

exports.listDeliveryBoys = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { status, approvalStatus, search } = req.query;

  const filter = {};
  if (status) {
    filter.status = status;
  }
  if (approvalStatus) {
    filter.approvalStatus = approvalStatus;
  }
  const searchOr = searchFilter(search, [
    "name",
    "email",
    "phone",
    "city",
    "licenseNumber",
    "vehicleRegistrationNumber",
    "vehicleType",
  ]);
  if (searchOr) {
    Object.assign(filter, searchOr);
  }

  const [deliveryBoys, total] = await Promise.all([
    DeliveryBoy.find(filter)
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DeliveryBoy.countDocuments(filter),
  ]);

  res.json({
    deliveryBoys: deliveryBoys.map((d) => toPublicProfile(d)),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  });
});

exports.getDeliveryBoyById = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const deliveryBoy = await DeliveryBoy.findById(req.params.id).select(
    "-passwordHash"
  );
  if (!deliveryBoy) {
    throw new AppError("Delivery partner not found", 404);
  }
  res.json({ deliveryBoy: toPublicProfile(deliveryBoy) });
});

exports.createDeliveryBoy = asyncHandler(async (req, res) => {
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
    status,
    approvalStatus,
  } = req.body;

  const uploaded = uploadedDeliveryFiles(req);

  if (!name || !email || !phone) {
    deleteUploaded([uploaded.profileImage, uploaded.drivingLicenseFront, uploaded.drivingLicenseBack]);
    throw new AppError("Name, email, and phone are required", 400);
  }

  const emailNorm = String(email).toLowerCase().trim();
  const existing = await DeliveryBoy.findOne({ email: emailNorm });
  if (existing) {
    deleteUploaded([uploaded.profileImage, uploaded.drivingLicenseFront, uploaded.drivingLicenseBack]);
    throw new AppError("Email is already in use", 409);
  }

  const passwordHash = password ? await hashPassword(password) : null;
  let deliveryBoy;
  try {
    const normalizedStatus = status || "active";
    const normalizedApprovalStatus = approvalStatus || "pending";
    if (!ALLOWED_STATUS.has(normalizedStatus)) throw new AppError("Invalid status", 400);
    if (!ALLOWED_APPROVAL_STATUS.has(normalizedApprovalStatus)) throw new AppError("Invalid approval status", 400);

    deliveryBoy = await DeliveryBoy.create({
      name,
      email: emailNorm,
      passwordHash,
      phone,
      dob: dob === "" ? undefined : dob,
      gender,
      fcm_id,
      city: city ?? null,
      address: address ?? null,
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
      status: normalizedStatus,
      approvalStatus: normalizedApprovalStatus,
      profileImage: uploaded.profileImage ?? profileImage ?? null,
    });
  } catch (err) {
    deleteUploaded([uploaded.profileImage, uploaded.drivingLicenseFront, uploaded.drivingLicenseBack]);
    throw err;
  }

  res.status(201).json({
    message: "Delivery partner created",
    deliveryBoy: toPublicProfile(
      await DeliveryBoy.findById(deliveryBoy._id).select("-passwordHash")
    ),
  });
});

exports.updateDeliveryBoy = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const deliveryBoy = await DeliveryBoy.findById(req.params.id);
  if (!deliveryBoy) {
    throw new AppError("Delivery partner not found", 404);
  }

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
    status,
    approvalStatus,
  } = req.body;
  const uploaded = uploadedDeliveryFiles(req);

  if (email !== undefined) {
    const emailNorm = String(email).toLowerCase().trim();
    const taken = await DeliveryBoy.findOne({
      email: emailNorm,
      _id: { $ne: deliveryBoy._id },
    });
    if (taken) {
      deleteUploaded([uploaded.profileImage, uploaded.drivingLicenseFront, uploaded.drivingLicenseBack]);
      throw new AppError("Email is already in use", 409);
    }
    deliveryBoy.email = emailNorm;
  }

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
  if (status !== undefined) {
    if (!ALLOWED_STATUS.has(status)) throw new AppError("Invalid status", 400);
    deliveryBoy.status = status;
  }
  if (approvalStatus !== undefined) {
    if (!ALLOWED_APPROVAL_STATUS.has(approvalStatus)) throw new AppError("Invalid approval status", 400);
    deliveryBoy.approvalStatus = approvalStatus;
  }
  if (password) {
    deliveryBoy.passwordHash = await hashPassword(password);
  }

  await deliveryBoy.save();
  res.json({
    message: "Delivery partner updated",
    deliveryBoy: toPublicProfile(
      await DeliveryBoy.findById(deliveryBoy._id).select("-passwordHash")
    ),
  });
});

exports.deleteDeliveryBoy = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const deliveryBoy = await DeliveryBoy.findById(req.params.id);
  if (!deliveryBoy) {
    throw new AppError("Delivery partner not found", 404);
  }
  deleteUploaded([
    deliveryBoy.profileImage,
    deliveryBoy.drivingLicenseFront,
    deliveryBoy.drivingLicenseBack,
  ]);
  await DeliveryBoy.findByIdAndDelete(req.params.id);
  res.json({ message: "Delivery partner deleted" });
});
