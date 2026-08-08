const mongoose = require("mongoose");

/**
 * Singleton document holding org-wide defaults.
 * Product-level overrides live on the Product model and win when present.
 */
const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "global", unique: true },

    lateFee: {
      gracePeriodMinutes: { type: Number, default: 60 },
      hourlyFee: { type: Number, default: 100 },
      dailyFee: { type: Number, default: 500 },
      // when delay > this many hours, switch from hourly to daily billing
      dailySwitchHours: { type: Number, default: 24 },
      maximumFee: { type: Number, default: 3000 },
    },

    paddingMinutes: { type: Number, default: 0 }, // security/cleaning buffer between rentals
    minimumRentalHours: { type: Number, default: 1 },

    unavailableWeekdays: {
      type: [Number], // 0 = Sunday ... 6 = Saturday
      default: [],
    },
    unavailableDates: {
      type: [Date], // specific holiday dates
      default: [],
    },

    currency: { type: String, default: "INR" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Settings", settingsSchema);
