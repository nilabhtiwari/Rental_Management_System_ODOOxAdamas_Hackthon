const asyncHandler = require("express-async-handler");
const Product = require("../models/Product");
const {
  getSettings,
  calculateRentalPrice,
  checkAvailability,
  checkMinimumDuration,
} = require("../utils/rentalEngine");

// @route GET /api/products
const listProducts = asyncHandler(async (req, res) => {
  const { category, isActive } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (isActive !== undefined) filter.isActive = isActive === "true";
  const products = await Product.find(filter).populate("category", "name slug");
  res.json(products);
});

// @route GET /api/products/:id
const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate("category", "name slug");
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  res.json(product);
});

// @route POST /api/products (admin/staff)
const createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json(product);
});

// @route PUT /api/products/:id (admin/staff)
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  res.json(product);
});

// @route DELETE /api/products/:id (admin)
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  res.json({ message: "Product deactivated" });
});

// @route POST /api/products/:id/quote
// body: { startAt, endAt, quantity }
// Lets the frontend preview price + availability BEFORE creating a rental.
// The same calculation is re-run server-side at order creation time -
// this endpoint never persists anything.
const quoteProduct = asyncHandler(async (req, res) => {
  const { startAt, endAt, quantity = 1 } = req.body;
  if (!startAt || !endAt) {
    res.status(400);
    throw new Error("startAt and endAt are required");
  }

  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const settings = await getSettings();

  const minDuration = checkMinimumDuration(startAt, endAt, product, settings);
  if (!minDuration.valid) {
    res.status(400);
    throw new Error(
      `Rental duration below minimum of ${minDuration.minimumRentalHours} hour(s)`
    );
  }

  const availability = await checkAvailability(product, startAt, endAt, Number(quantity), settings);
  const pricing = calculateRentalPrice(product, startAt, endAt, Number(quantity));

  res.json({
    available: availability.available,
    availableQty: availability.availableQty,
    pricing,
    securityDeposit: product.securityDeposit,
    estimatedTotal: pricing.rentalSubtotal + product.securityDeposit,
  });
});

module.exports = { listProducts, getProduct, createProduct, updateProduct, deleteProduct, quoteProduct };
