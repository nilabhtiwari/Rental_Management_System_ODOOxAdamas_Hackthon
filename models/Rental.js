const mongoose = require("mongoose");

const RENTAL_STATUSES = [
  "QUOTATION",
  "RESERVED",
  "CONFIRMED",
  "READY_FOR_PICKUP",
  "PICKED_UP",
  "ACTIVE",
  "RETURN_DUE",
  "OVERDUE",
  "RETURNED",
  "INSPECTION",
  "DEPOSIT_SETTLEMENT",
  "COMPLETED",
  "CANCELLED",
];

// allowed forward transitions - used to guard status changes
const VALID_TRANSITIONS = {
  QUOTATION: ["RESERVED", "CANCELLED"],
  RESERVED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["ACTIVE"],
  ACTIVE: ["RETURN_DUE", "OVERDUE", "RETURNED"],
  RETURN_DUE: ["OVERDUE", "RETURNED"],
  OVERDUE: ["RETURNED"],
  RETURNED: ["INSPECTION"],
  INSPECTION: ["DEPOSIT_SETTLEMENT"],
  DEPOSIT_SETTLEMENT: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

const rentalSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, default: 1, min: 1 },

    status: { type: String, enum: RENTAL_STATUSES, default: "QUOTATION" },

    // scheduling
    startAt: { type: Date, required: true }, // expected pickup
    expectedReturnAt: { type: Date, required: true },
    actualPickupAt: { type: Date },
    actualReturnAt: { type: Date },

    // pricing snapshot (never trust client-sent totals)
    pricing: {
      unit: { type: String, enum: ["hour", "day", "week", "month"] },
      unitPrice: { type: Number },
      billedUnits: { type: Number },
      rentalSubtotal: { type: Number, default: 0 },
    },

    securityDeposit: {
      amount: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ["HELD", "PARTIALLY_REFUNDED", "REFUNDED", "DEDUCTED"],
        default: "HELD",
      },
      refundedAmount: { type: Number, default: 0 },
    },

    lateFee: {
      gracePeriodMinutes: { type: Number, default: 0 },
      delayMinutes: { type: Number, default: 0 },
      billableDelayUnits: { type: Number, default: 0 },
      billingType: { type: String, enum: ["hourly", "daily", null], default: null },
      amount: { type: Number, default: 0 },
    },

    damage: {
      description: { type: String },
      deduction: { type: Number, default: 0 },
      photos: [{ type: String }],
    },

    refundableAmount: { type: Number, default: 0 },

    payment: {
      status: { type: String, enum: ["PENDING", "PAID", "PARTIALLY_PAID", "REFUNDED"], default: "PENDING" },
      amountPaid: { type: Number, default: 0 },
    },

    notes: { type: String },
  },
  { timestamps: true }
);

rentalSchema.statics.RENTAL_STATUSES = RENTAL_STATUSES;
rentalSchema.statics.VALID_TRANSITIONS = VALID_TRANSITIONS;

rentalSchema.methods.canTransitionTo = function (nextStatus) {
  const allowed = VALID_TRANSITIONS[this.status] || [];
  return allowed.includes(nextStatus);
};

module.exports = mongoose.model("Rental", rentalSchema);
