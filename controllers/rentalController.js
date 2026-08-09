const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Rental = require("../models/Rental");
const Product = require("../models/Product");
const { syncOverdueStatuses } = require("../utils/overdueCheck");
const {
  getSettings,
  calculateRentalPrice,
  checkAvailability,
  checkUnavailableDays,
  checkMinimumDuration,
} = require("../utils/rentalEngine");

// @route POST /api/rentals
// Creates a rental in QUOTATION/RESERVED status.
// ALL pricing, availability and deposit figures are computed here -
// nothing from req.body is trusted for money-related fields.
const createRental = asyncHandler(async (req, res) => {
  const { productId, quantity = 1, startAt, expectedReturnAt, notes } = req.body;
  const customerId = req.user ? req.user._id : req.body.customerId;

  if (!productId || !startAt || !expectedReturnAt || !customerId) {
    res.status(400);
    throw new Error("productId, customerId, startAt and expectedReturnAt are required");
  }

  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    res.status(404);
    throw new Error("Product not found or inactive");
  }

  const settings = await getSettings();

  const minDuration = checkMinimumDuration(startAt, expectedReturnAt, product, settings);
  if (!minDuration.valid) {
    res.status(400);
    throw new Error(`Rental duration below minimum of ${minDuration.minimumRentalHours} hour(s)`);
  }

  const startBlock = checkUnavailableDays(startAt, settings);
  if (startBlock.blocked) {
    res.status(400);
    throw new Error(`Pickup date invalid: ${startBlock.reason}`);
  }
  const endBlock = checkUnavailableDays(expectedReturnAt, settings);
  if (endBlock.blocked) {
    res.status(400);
    throw new Error(`Return date invalid: ${endBlock.reason}`);
  }

  const availability = await checkAvailability(product, startAt, expectedReturnAt, Number(quantity), settings);
  if (!availability.available) {
    res.status(409);
    throw new Error(
      `Only ${availability.availableQty} unit(s) available for the selected dates, requested ${quantity}`
    );
  }

  const pricing = calculateRentalPrice(product, startAt, expectedReturnAt, Number(quantity));

  const rental = await Rental.create({
    customer: customerId,
    product: product._id,
    quantity: Number(quantity),
    status: "RESERVED",
    startAt,
    expectedReturnAt,
    pricing,
    securityDeposit: { amount: product.securityDeposit, status: "HELD" },
    notes,
  });

  res.status(201).json(rental);
});

// @route GET /api/rentals
// Supports filtering by status, customer, product; auto-syncs overdue first.
const listRentals = asyncHandler(async (req, res) => {
  await syncOverdueStatuses();

  const { status, customer, product, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (customer) filter.customer = customer;
  if (product) filter.product = product;

  // customers only ever see their own rentals
  if (req.user && req.user.role === "customer") filter.customer = req.user._id;

  const rentals = await Rental.find(filter)
    .populate("product", "name images securityDeposit")
    .populate("customer", "name email phone")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await Rental.countDocuments(filter);

  res.json({ rentals, total, page: Number(page), pages: Math.ceil(total / limit) });
});

// @route GET /api/rentals/:id
const getRental = asyncHandler(async (req, res) => {
  await syncOverdueStatuses();
  const rental = await Rental.findById(req.params.id)
    .populate("product")
    .populate("customer", "name email phone");
  if (!rental) {
    res.status(404);
    throw new Error("Rental not found");
  }
  if (req.user.role === "customer" && String(rental.customer._id) !== String(req.user._id)) {
    res.status(403);
    throw new Error("Forbidden");
  }
  res.json(rental);
});

// @route PATCH /api/rentals/:id/status  { status }
// Generic guarded transition for statuses not covered by the dedicated
// pickup/return endpoints (e.g. CONFIRMED, READY_FOR_PICKUP, CANCELLED).
const updateRentalStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const rental = await Rental.findById(req.params.id);
  if (!rental) {
    res.status(404);
    throw new Error("Rental not found");
  }
  if (!rental.canTransitionTo(status)) {
    res.status(400);
    throw new Error(`Cannot transition from ${rental.status} to ${status}`);
  }
  rental.status = status;
  await rental.save();
  res.json(rental);
});

// @route GET /api/rentals/dashboard
const getDashboard = asyncHandler(async (req, res) => {
  await syncOverdueStatuses();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const [
    activeRentals,
    dueToday,
    upcomingPickups,
    upcomingReturns,
    overdueRentals,
    completedRentals,
    cancelledRentals,
    revenueAgg,
    depositsHeldAgg,
    depositsRefundedAgg,
    lateFeeAgg,
  ] = await Promise.all([
    Rental.countDocuments({ status: { $in: ["ACTIVE", "PICKED_UP"] } }),
    Rental.countDocuments({
      status: { $in: ["ACTIVE", "RETURN_DUE"] },
      expectedReturnAt: { $gte: startOfToday, $lte: endOfToday },
    }),
    Rental.countDocuments({
      status: { $in: ["CONFIRMED", "READY_FOR_PICKUP"] },
      startAt: { $gte: startOfToday, $lte: endOfToday },
    }),
    Rental.countDocuments({
      status: { $in: ["ACTIVE", "RETURN_DUE"] },
      expectedReturnAt: { $gte: startOfToday, $lte: endOfToday },
    }),
    Rental.countDocuments({ status: "OVERDUE" }),
    Rental.countDocuments({ status: "COMPLETED" }),
    Rental.countDocuments({ status: "CANCELLED" }),
    Rental.aggregate([
      { $match: { status: { $ne: "CANCELLED" } } },
      { $group: { _id: null, total: { $sum: "$pricing.rentalSubtotal" } } },
    ]),
    Rental.aggregate([
      { $match: { "securityDeposit.status": "HELD" } },
      { $group: { _id: null, total: { $sum: "$securityDeposit.amount" } } },
    ]),
    Rental.aggregate([
      { $group: { _id: null, total: { $sum: "$securityDeposit.refundedAmount" } } },
    ]),
    Rental.aggregate([{ $group: { _id: null, total: { $sum: "$lateFee.amount" } } }]),
  ]);

  res.json({
    activeRentals,
    dueToday,
    upcomingPickups,
    upcomingReturns,
    overdueRentals,
    completedRentals,
    cancelledRentals,
    rentalRevenue: revenueAgg[0]?.total || 0,
    securityDepositsHeld: depositsHeldAgg[0]?.total || 0,
    securityDepositsRefunded: depositsRefundedAgg[0]?.total || 0,
    lateFeeCollection: lateFeeAgg[0]?.total || 0,
  });
});

module.exports = { createRental, listRentals, getRental, updateRentalStatus, getDashboard };
