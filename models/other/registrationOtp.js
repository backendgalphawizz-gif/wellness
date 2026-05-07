const mongoose = require("mongoose");

const registrationOtpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    phoneCountryCode: { type: String, required: true, trim: true, default: "+91" },
    phone: { type: String, required: true, trim: true },
    otp: { type: String, required: true },
    otpExpire: { type: Date, required: true },
  },
  { timestamps: true }
);

registrationOtpSchema.index({ email: 1, phoneCountryCode: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model("RegistrationOtp", registrationOtpSchema);
