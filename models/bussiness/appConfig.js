const mongoose = require("mongoose");

const paymentGatewaySchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["razorpay", "stripe", "paypal", "paytm"],
      required: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    credentials: {
      key_id: { type: String, default: "" },
      key_secret: { type: String, default: "" },
      webhook_secret: { type: String, default: "" },
      merchant_id: { type: String, default: "" },
    },
  },
  { _id: false }
);

const paymentMethodSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["cod", "online", "wallet"],
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const appConfigSchema = new mongoose.Schema(
  {
    app_name: {
      type: String,
      required: true,
      trim: true,
    },
    app_email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    app_mobile: {
      type: String,
      required: true,
    },
    app_detail: {
      type: String,
      default: "",
    },

    admin_logo: {
      type: String,
      default: "",
    },
    user_logo: {
      type: String,
      default: "",
    },
    favicon: {
      type: String,
      default: "",
    },

    address: {
      type: String,
      default: "",
    },
    latitude: {
      type: String,
      default: "",
    },
    longitude: {
      type: String,
      default: "",
    },
    facebook: {
      type: String,
      default: "",
    },
    twitter: {
      type: String,
      default: "",
    },
    instagram: {
      type: String,
      default: "",
    },
    linkedin: {
      type: String,
      default: "",
    },

    app_details: {
      type: String,
      default: "",
    },
    app_footer_text: {
      type: String,
      default: "",
    },
    payment_methods: {
      type: [paymentMethodSchema],
      default: () => [
        { type: "cod", isActive: true },
        { type: "online", isActive: true },
      ],
    },
    payment_gateways: {
      type: [paymentGatewaySchema],
      default: () => [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AppConfig", appConfigSchema);
