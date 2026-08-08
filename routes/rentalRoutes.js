const express = require("express");
const {
  createRental,
  listRentals,
  getRental,
  updateRentalStatus,
  getDashboard,
} = require("../controllers/rentalController");
const { protect, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(protect);

router.get("/dashboard", requireRole("admin", "staff"), getDashboard);
router.get("/", listRentals);
router.get("/:id", getRental);
router.post("/", createRental);
router.patch("/:id/status", requireRole("admin", "staff"), updateRentalStatus);

module.exports = router;
