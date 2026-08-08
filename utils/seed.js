require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Settings = require("../models/Settings");

const run = async () => {
  await connectDB();

  await Promise.all([
    User.deleteMany({ email: { $in: ["admin@rental.com", "customer@rental.com"] } }),
    Category.deleteMany({ slug: { $in: ["electronics"] } }),
    Product.deleteMany({ slug: { $in: ["laptop-dell-xps", "camera-sony-a7"] } }),
  ]);

  const admin = await User.create({
    name: "Admin",
    email: "admin@rental.com",
    password: "password123",
    role: "admin",
  });

  const customer = await User.create({
    name: "Test Customer",
    email: "customer@rental.com",
    password: "password123",
    role: "customer",
  });

  const electronics = await Category.create({ name: "Electronics", slug: "electronics" });

  const laptop = await Product.create({
    name: "Dell XPS 15 Laptop",
    slug: "laptop-dell-xps",
    description: "High performance laptop, ideal for work and editing.",
    category: electronics._id,
    brand: "Dell",
    totalQuantity: 5,
    pricingTiers: [
      { unit: "hour", duration: 1, price: 100 },
      { unit: "day", duration: 1, price: 500 },
      { unit: "week", duration: 1, price: 2800 },
    ],
    securityDeposit: 3000,
  });

  const camera = await Product.create({
    name: "Sony A7 Camera",
    slug: "camera-sony-a7",
    description: "Full-frame mirrorless camera with kit lens.",
    category: electronics._id,
    brand: "Sony",
    totalQuantity: 3,
    pricingTiers: [
      { unit: "hour", duration: 1, price: 200 },
      { unit: "day", duration: 1, price: 1000 },
      { unit: "week", duration: 1, price: 5000 },
    ],
    securityDeposit: 5000,
    lateFeeOverride: { hourlyFee: 150, dailyFee: 700, maximumFee: 5000 },
  });

  await Settings.findOneAndUpdate(
    { key: "global" },
    {
      key: "global",
      lateFee: { gracePeriodMinutes: 60, hourlyFee: 100, dailyFee: 500, dailySwitchHours: 24, maximumFee: 3000 },
      paddingMinutes: 240,
      minimumRentalHours: 1,
      unavailableWeekdays: [0], // Sunday
    },
    { upsert: true }
  );

  console.log("Seed complete:");
  console.log(`  Admin login:    admin@rental.com / password123`);
  console.log(`  Customer login: customer@rental.com / password123`);
  console.log(`  Products: ${laptop.name}, ${camera.name}`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
