const asyncHandler = require("express-async-handler");
const Settings = require("../models/Settings");

// @route GET /api/settings
const getSettingsHandler = asyncHandler(async (req, res) => {
  let settings = await Settings.findOne({ key: "global" });
  if (!settings) settings = await Settings.create({ key: "global" });
  res.json(settings);
});

// @route PUT /api/settings (admin)
const updateSettingsHandler = asyncHandler(async (req, res) => {
  const settings = await Settings.findOneAndUpdate({ key: "global" }, req.body, {
    new: true,
    upsert: true,
    runValidators: true,
  });
  res.json(settings);
});

module.exports = { getSettingsHandler, updateSettingsHandler };
