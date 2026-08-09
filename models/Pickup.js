const mongoose = require("mongoose");

const pickupSchema = new mongoose.Schema(
  {
    rental: { type: mongoose.Schema.Types.ObjectId, ref: "Rental", required: true },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // admin/staff
    quantityHandedOver: { type: Number, required: true },
    pickupTime: { type: Date, required: true, default: Date.now },
    conditionNotes: { type: String },
    receiptNumber: { type: String, unique: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Pickup", pickupSchema);
