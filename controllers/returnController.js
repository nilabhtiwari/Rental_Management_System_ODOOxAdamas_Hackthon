const asyncHandler = require("express-async-handler");
const Rental = require("../models/Rental");
const Product = require("../models/Product");
const ReturnModel = require("../models/Return");
const InventoryTransaction = require("../models/InventoryTransaction");
const { getSettings, calculateLateFee, calculateRefund } = require("../utils/rentalEngine");

const genReceiptNumber = (prefix) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

// @route GET /api/returns/today
const todaysReturns = asyncHandler(async (req, res) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const rentals = await Rental.find({
    status: { $in: ["ACTIVE", "RETURN_DUE", "OVERDUE"] },
    expectedReturnAt: { $gte: start, $lte: end },
  })
    .populate("product", "name")
    .populate("customer", "name phone email");

  res.json(rentals);
});

// @route GET /api/returns/overdue
const overdueReturns = asyncHandler(async (req, res) => {
  const rentals = await Rental.find({ status: "OVERDUE" })
    .populate("product", "name")
    .populate("customer", "name phone email");
  res.json(rentals);
});

// @route POST /api/returns
// body: { rentalId, quantityReturned, condition, missingAccessories, notes,
//         photos, damageDeduction }
// This is the single most important write endpoint in the system:
// it is the ONLY place late fees and deposit refunds get computed and saved.
const recordReturn = asyncHandler(async (req, res) => {
  const {
    rentalId,
    quantityReturned,
    condition = "good",
    missingAccessories = [],
    notes,
    photos = [],
    damageDeduction = 0,
  } = req.body;

  const rental = await Rental.findById(rentalId);
  if (!rental) {
    res.status(404);
    throw new Error("Rental not found");
  }
  if (!["ACTIVE", "RETURN_DUE", "OVERDUE"].includes(rental.status)) {
    res.status(400);
    throw new Error(`Rental in status ${rental.status} is not eligible for return`);
  }
  if (Number(quantityReturned) !== rental.quantity) {
    res.status(400);
    throw new Error(`Quantity mismatch: expected ${rental.quantity}, got ${quantityReturned}`);
  }

  const product = await Product.findById(rental.product);
  const settings = await getSettings();
  const returnTime = new Date();

  // --- backend-authoritative late fee calculation ---
  const lateFee = calculateLateFee(rental.expectedReturnAt, returnTime, product, settings);

  // damage deduction is admin-entered at inspection time (can't be automated),
  // but is still clamped server-side, never trusted blindly for the refund math
  const safeDamageDeduction = Math.max(0, Number(damageDeduction) || 0);

  const refund = calculateRefund(rental.securityDeposit.amount, lateFee.amount, safeDamageDeduction);

  const returnRecord = await ReturnModel.create({
    rental: rental._id,
    inspectedBy: req.user._id,
    quantityReturned: Number(quantityReturned),
    returnTime,
    condition,
    missingAccessories,
    notes,
    photos,
    receiptNumber: genReceiptNumber("RT"),
    lateFeeCharged: lateFee.amount,
    damageDeduction: safeDamageDeduction,
    refundIssued: refund.refundableAmount,
  });

  await InventoryTransaction.create({
    product: rental.product,
    rental: rental._id,
    type: "RETURN_IN",
    quantity: Math.abs(rental.quantity),
    note: `Returned against receipt ${returnRecord.receiptNumber}`,
  });

  // if padding is configured, put the unit on a maintenance hold until
  // paddingMinutes has elapsed - handled implicitly by checkAvailability()
  // reading actualReturnAt + padding, so no extra transaction is required.

  rental.status = "RETURNED";
  rental.actualReturnAt = returnTime;
  rental.lateFee = lateFee;
  rental.damage = { description: notes, deduction: safeDamageDeduction, photos };
  rental.securityDeposit.status = refund.status;
  rental.securityDeposit.refundedAmount = refund.refundableAmount;
  rental.refundableAmount = refund.refundableAmount;

  // move straight through inspection -> settlement -> completed since the
  // inspection data was captured in this same request
  rental.status = "COMPLETED";
  await rental.save();

  res.status(201).json({ return: returnRecord, rental, lateFee, refund });
});

module.exports = { todaysReturns, overdueReturns, recordReturn };
