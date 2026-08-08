const express = require("express");
const { todaysPickups, recordPickup } = require("../controllers/pickupController");
const { protect, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(protect, requireRole("admin", "staff"));

router.get("/today", todaysPickups);
router.post("/", recordPickup);

module.exports = router;
