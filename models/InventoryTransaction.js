const mongoose = require("mongoose");

const inventoryTransactionSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    rental: { type: mongoose.Schema.Types.ObjectId, ref: "Rental" },
    type: {
      type: String,
      enum: ["PICKUP_OUT", "RETURN_IN", "MAINTENANCE_HOLD", "MAINTENANCE_RELEASE", "ADJUSTMENT"],
      required: true,
    },
    quantity: { type: Number, required: true },
    note: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("InventoryTransaction", inventoryTransactionSchema);
