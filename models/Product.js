const mongoose = require("mongoose");

const pricingTierSchema = new mongoose.Schema(
  {
    unit: { type: String, enum: ["hour", "day", "week", "month"], required: true },
    duration: { type: Number, required: true, default: 1 }, // e.g. 4 hours, 3 days
    price: { type: Number, required: true },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    brand: { type: String },
    images: [{ type: String }],

    // total owned quantity of this product (identical units)
    totalQuantity: { type: Number, required: true, default: 1 },

    // rental pricing ladder, cheapest granularity to largest
    pricingTiers: { type: [pricingTierSchema], default: [] },

    securityDeposit: { type: Number, default: 0 },

    // product-level overrides; if absent, fall back to global Settings
    lateFeeOverride: {
      gracePeriodMinutes: { type: Number },
      hourlyFee: { type: Number },
      dailyFee: { type: Number },
      dailySwitchHours: { type: Number },
      maximumFee: { type: Number },
    },
    paddingMinutesOverride: { type: Number },
    minimumRentalHoursOverride: { type: Number },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
