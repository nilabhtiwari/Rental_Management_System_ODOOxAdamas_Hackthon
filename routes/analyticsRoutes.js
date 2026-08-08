const express = require("express");
const {
  revenueAnalytics,
  rentalTrendAnalytics,
  statusAnalytics,
  productDemandAnalytics,
  lateFeeAnalytics,
  depositAnalytics,
} = require("../controllers/analyticsController");
const { protect, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(protect, requireRole("admin", "staff"));

router.get("/revenue", revenueAnalytics);
router.get("/rentals", rentalTrendAnalytics);
router.get("/status", statusAnalytics);
router.get("/products", productDemandAnalytics);
router.get("/late-fees", lateFeeAnalytics);
router.get("/deposits", depositAnalytics);

module.exports = router;
