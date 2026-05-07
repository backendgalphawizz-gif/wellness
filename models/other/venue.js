const mongoose = require("mongoose");

const ALLOWED_STATUS = ["active", "inactive"];
const ALLOWED_ROLES = ["Admin", "VenueVendor", "Vendor"];

const venueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, default: "", trim: true },
    shortDescription: { type: String, default: "", trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    subCategory: { type: mongoose.Schema.Types.ObjectId, ref: "SubCategory", required: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, default: "", trim: true },
    state: { type: String, default: "", trim: true },
    pincode: { type: String, default: "", trim: true },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    thumbnail: { type: String, required: true, trim: true },
    images: { type: [String], default: [] },
    amenities: [{ type: mongoose.Schema.Types.ObjectId, ref: "Amenity" }],
    capacity: { type: Number, default: 0, min: 0 },
    basePrice: { type: Number, default: 0, min: 0 },
    role: { type: String, enum: ALLOWED_ROLES, default: "Admin", trim: true },
    addedById: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: "role" },
    adminApproved: { type: Boolean, default: false },
    status: { type: String, enum: ALLOWED_STATUS, default: "active" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("Venue", venueSchema);
