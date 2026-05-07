const mongoose = require("mongoose");

const healthConcernSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    icon: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("HealthConcern", healthConcernSchema);