const mongoose = require("mongoose");

const STATUS = ["active", "inactive"];
const AUDIENCE_TYPES = ["users", "coaches"];

const notificationSchema = new mongoose.Schema(
  {
    audienceType: {
      type: String,
      required: true,
      enum: AUDIENCE_TYPES,
      trim: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    image: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: STATUS,
      default: "active",
      index: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Notification", notificationSchema);
