const express = require("express");
const { todaysReturns, overdueReturns, recordReturn } = require("../controllers/returnController");
const { protect, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(protect, requireRole("admin", "staff"));

router.get("/today", todaysReturns);
router.get("/overdue", overdueReturns);
router.post("/", recordReturn);

module.exports = router;
