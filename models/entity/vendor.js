const mongoose = require("mongoose");

const STATUS = ["active", "inactive", "blocked"];
const APPROVAL_STATUS = ["pending", "approved", "rejected", "suspended"];
const GENDER = ["male", "female", "other"];
const ACCOUNT_TYPE = ["Current", "Savings"];

const vendorSchema = new mongoose.Schema(
  {
    // Identity
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, default: null, select: false },
    phone: { type: String, required: true, trim: true },
    dob: { type: Date, default: null },
    gender: { type: String, enum: GENDER, default: "male" },
    profileImage: { type: String, default: null, trim: true },
    fcm_id: { type: String, default: null, trim: true },

    // Business
    businessName: { type: String, required: true, trim: true},
    businessPhone: { type: String, default: null, trim: true },
    gstin: { type: String, default: null, trim: true },
    panCardNumber: { type: String, default: null, trim: true },
    businessAddress: { type: String, default: null, trim: true },

    // Documents / media
    aadhaarCardFront: { type: String, default: null, trim: true },
    aadhaarCardBack: { type: String, default: null, trim: true },
    panCardFront: { type: String, default: null, trim: true},
    shopLogo: { type: String, default: null, trim: true },
    shopImage: { type: String, default: null, trim: true },
    shopBanner: { type: String, default: null, trim: true },

    // Banking
    bankName: { type: String, default: null, trim: true},
    branchName: { type: String, default: null, trim: true },
    accountNo: { type: String, default: null, trim: true },
    ifsc: { type: String, default: null, trim: true },
    accountType: { type: String, enum: ACCOUNT_TYPE, default: "Current" },

    // Auth / account lifecycle
    otp: { type: String, default: null, select: false },
    otpExpire: { type: Date, default: null, select: false },
    resetPasswordToken: { type: String, default: null, select: false },
    resetPasswordExpire: { type: Date, default: null, select: false },
    status: { type: String, enum: STATUS, default: "active", index: true },
    approvalStatus: { type: String, enum: APPROVAL_STATUS, default: "pending", index: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

vendorSchema.index({ createdAt: -1 });
vendorSchema.index({ businessName: 1 });

module.exports = mongoose.model("Vendor", vendorSchema);
