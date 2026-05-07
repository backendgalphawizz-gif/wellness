const mongoose = require("mongoose");

const STATUS = ["active", "inactive"];
const DISCOUNT_TYPES = ["percentage", "flat"];

const promotionSchema = new mongoose.Schema(
  {
    promoCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    displayMessage: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      required: true,
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    discountType: {
      type: String,
      required: true,
      enum: DISCOUNT_TYPES,
      trim: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minimumOrderAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    maximumDiscountAmount: {
      type: Number,
      min: 0,
    },
    totalUsageLimit: {
      type: Number,
      required: true,
      min: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: STATUS,
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

promotionSchema.index({ promoCode: 1 }, { unique: true });

module.exports = mongoose.model("Promotion", promotionSchema);
