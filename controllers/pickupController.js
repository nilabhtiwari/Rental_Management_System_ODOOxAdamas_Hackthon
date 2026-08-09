const asyncHandler = require("express-async-handler");
const Rental = require("../models/Rental");
const Pickup = require("../models/Pickup");
const InventoryTransaction = require("../models/InventoryTransaction");

const genReceiptNumber = (prefix) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

// @route GET /api/pickups/today
const todaysPickups = asyncHandler(async (req, res) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const rentals = await Rental.find({
    status: { $in: ["CONFIRMED", "READY_FOR_PICKUP"] },
    startAt: { $gte: start, $lte: end },
  })
    .populate("product", "name")
    .populate("customer", "name phone email");

  res.json(rentals);
});

// @route POST /api/pickups
// body: { rentalId, quantityHandedOver, conditionNotes }
const recordPickup = asyncHandler(async (req, res) => {
  const { rentalId, quantityHandedOver, conditionNotes } = req.body;

  const rental = await Rental.findById(rentalId);
  if (!rental) {
    res.status(404);
    throw new Error("Rental not found");
  }
  if (!["CONFIRMED", "READY_FOR_PICKUP"].includes(rental.status)) {
    res.status(400);
    throw new Error(`Rental in status ${rental.status} is not eligible for pickup`);
  }
  if (Number(quantityHandedOver) !== rental.quantity) {
    res.status(400);
    throw new Error(`Quantity mismatch: rental requires ${rental.quantity}, got ${quantityHandedOver}`);
  }

  const pickupTime = new Date();

  const pickup = await Pickup.create({
    rental: rental._id,
    verifiedBy: req.user._id,
    quantityHandedOver: Number(quantityHandedOver),
    pickupTime,
    conditionNotes,
    receiptNumber: genReceiptNumber("PU"),
  });

  await InventoryTransaction.create({
    product: rental.product,
    rental: rental._id,
    type: "PICKUP_OUT",
    quantity: -Math.abs(rental.quantity),
    note: `Picked up against receipt ${pickup.receiptNumber}`,
  });

  rental.status = "ACTIVE";
  rental.actualPickupAt = pickupTime;
  await rental.save();

  res.status(201).json({ pickup, rental });
});

module.exports = { todaysPickups, recordPickup };
