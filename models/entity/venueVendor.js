const mongoose = require("mongoose");

const STATUS = ["active", "inactive", "blocked"];
const APPROVAL_STATUS = ["pending", "approved", "rejected", "suspended"];
const ACCOUNT_TYPE = ["Current", "Savings"];
const GENDER = ["male", "female", "other"];

const venueVendorSchema = new mongoose.Schema(
  {
    // Personal details
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, required: true, trim: true },
    gender: { type: String, enum: GENDER, default: "male" },
    profileImage: { type: String, default: null, trim: true },

    // Auth / notifications
    passwordHash: { type: String, default: null, select: false },
    fcm_id: { type: String, default: null, trim: true },

    // Business details
    businessName: { type: String, required: true, trim: true },
    businessPhone: { type: String, default: null, trim: true },
    businessEmail: { type: String, default: null, trim: true, lowercase: true },
    businessAddress: { type: String, default: null, trim: true },
    businessDescription: { type: String, default: null, trim: true },
    panNumber: { type: String, default: null, trim: true },
    gstNumber: { type: String, default: null, trim: true },

    // Bank details
    bankName: { type: String, default: null, trim: true },
    branchName: { type: String, default: null, trim: true },
    accountType: { type: String, enum: ACCOUNT_TYPE, default: "Current" },
    accountNumber: { type: String, default: null, trim: true },
    ifscCode: { type: String, default: null, trim: true },

    // Documents upload
    aadhaarCard: { type: String, default: null, trim: true },
    panCard: { type: String, default: null, trim: true },

    // Account lifecycle
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

venueVendorSchema.index({ createdAt: -1 });
venueVendorSchema.index({ businessName: 1 });

module.exports = mongoose.model("VenueVendor", venueVendorSchema);
