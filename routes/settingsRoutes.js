const express = require("express");
const { getSettingsHandler, updateSettingsHandler } = require("../controllers/settingsController");
const { protect, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", protect, requireRole("admin", "staff"), getSettingsHandler);
router.put("/", protect, requireRole("admin"), updateSettingsHandler);

module.exports = router;
