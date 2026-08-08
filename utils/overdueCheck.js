const Rental = require("../models/Rental");

/**
 * Flip any ACTIVE/RETURN_DUE rental whose expectedReturnAt has passed into
 * OVERDUE. Called opportunistically on dashboard load, rental list, and
 * rental detail fetch so no scheduled job is required for v1.
 */
async function syncOverdueStatuses() {
  const now = new Date();
  const result = await Rental.updateMany(
    {
      status: { $in: ["ACTIVE", "RETURN_DUE"] },
      actualReturnAt: null,
      expectedReturnAt: { $lt: now },
    },
    { $set: { status: "OVERDUE" } }
  );
  return result.modifiedCount;
}

module.exports = { syncOverdueStatuses };
