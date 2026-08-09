const asyncHandler = require("express-async-handler");
const Rental = require("../models/Rental");

/** Resolve a ?range=7d|30d|90d|custom query param into a start date. */
function resolveStartDate(req) {
  const { range = "30d", from } = req.query;
  if (from) return new Date(from);
  const days = { "7d": 7, "30d": 30, "90d": 90 }[range] || 30;
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

// @route GET /api/analytics/revenue?range=30d
const revenueAnalytics = asyncHandler(async (req, res) => {
  const start = resolveStartDate(req);
  const data = await Rental.aggregate([
    { $match: { createdAt: { $gte: start }, status: { $ne: "CANCELLED" } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        revenue: { $sum: "$pricing.rentalSubtotal" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  res.json(data.map((d) => ({ date: d._id, revenue: d.revenue, orders: d.orders })));
});

// @route GET /api/analytics/rentals?range=30d
const rentalTrendAnalytics = asyncHandler(async (req, res) => {
  const start = resolveStartDate(req);
  const data = await Rental.aggregate([
    { $match: { createdAt: { $gte: start } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  res.json(data.map((d) => ({ date: d._id, count: d.count })));
});

// @route GET /api/analytics/status
const statusAnalytics = asyncHandler(async (req, res) => {
  const data = await Rental.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  res.json(data.map((d) => ({ status: d._id, count: d.count })));
});

// @route GET /api/analytics/products?range=30d&limit=10
const productDemandAnalytics = asyncHandler(async (req, res) => {
  const start = resolveStartDate(req);
  const limit = Number(req.query.limit) || 10;
  const data = await Rental.aggregate([
    { $match: { createdAt: { $gte: start }, status: { $ne: "CANCELLED" } } },
    { $group: { _id: "$product", rentalCount: { $sum: 1 }, totalQty: { $sum: "$quantity" } } },
    { $sort: { rentalCount: -1 } },
    { $limit: limit },
    {
      $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" },
    },
    { $unwind: "$product" },
    { $project: { productName: "$product.name", rentalCount: 1, totalQty: 1 } },
  ]);
  res.json(data);
});

// @route GET /api/analytics/late-fees?range=30d
const lateFeeAnalytics = asyncHandler(async (req, res) => {
  const start = resolveStartDate(req);
  const data = await Rental.aggregate([
    { $match: { actualReturnAt: { $gte: start }, "lateFee.amount": { $gt: 0 } } },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m", date: "$actualReturnAt" },
        },
        totalLateFees: { $sum: "$lateFee.amount" },
        overdueRentalCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  res.json(data.map((d) => ({ month: d._id, totalLateFees: d.totalLateFees, overdueRentalCount: d.overdueRentalCount })));
});

// @route GET /api/analytics/deposits
const depositAnalytics = asyncHandler(async (req, res) => {
  const data = await Rental.aggregate([
    {
      $group: {
        _id: "$securityDeposit.status",
        totalAmount: { $sum: "$securityDeposit.amount" },
        totalRefunded: { $sum: "$securityDeposit.refundedAmount" },
        count: { $sum: 1 },
      },
    },
  ]);
  res.json(data.map((d) => ({ status: d._id, totalAmount: d.totalAmount, totalRefunded: d.totalRefunded, count: d.count })));
});

module.exports = {
  revenueAnalytics,
  rentalTrendAnalytics,
  statusAnalytics,
  productDemandAnalytics,
  lateFeeAnalytics,
  depositAnalytics,
};
