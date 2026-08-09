const mongoose = require("mongoose");

const returnSchema = new mongoose.Schema(
  {
    rental: { type: mongoose.Schema.Types.ObjectId, ref: "Rental", required: true },
    inspectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    quantityReturned: { type: Number, required: true },
    returnTime: { type: Date, required: true, default: Date.now },
    condition: { type: String, enum: ["good", "minor_damage", "major_damage", "missing_parts"], default: "good" },
    missingAccessories: [{ type: String }],
    notes: { type: String },
    photos: [{ type: String }],
    receiptNumber: { type: String, unique: true },

    // snapshot of calculated figures at time of return, for audit trail
    lateFeeCharged: { type: Number, default: 0 },
    damageDeduction: { type: Number, default: 0 },
    refundIssued: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Return", returnSchema);
