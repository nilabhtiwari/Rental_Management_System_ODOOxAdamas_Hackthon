const Rental = require("../models/Rental");
const Settings = require("../models/Settings");

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Fetch the singleton settings doc, creating defaults if missing. */
async function getSettings() {
  let settings = await Settings.findOne({ key: "global" });
  if (!settings) settings = await Settings.create({ key: "global" });
  return settings;
}

/**
 * Merge product-level overrides on top of global settings.
 * Product-level values win whenever they are explicitly set.
 */
function resolveEffectiveRules(product, settings) {
  const lf = product.lateFeeOverride || {};
  return {
    gracePeriodMinutes: lf.gracePeriodMinutes ?? settings.lateFee.gracePeriodMinutes,
    hourlyFee: lf.hourlyFee ?? settings.lateFee.hourlyFee,
    dailyFee: lf.dailyFee ?? settings.lateFee.dailyFee,
    dailySwitchHours: lf.dailySwitchHours ?? settings.lateFee.dailySwitchHours,
    maximumFee: lf.maximumFee ?? settings.lateFee.maximumFee,
    paddingMinutes: product.paddingMinutesOverride ?? settings.paddingMinutes,
    minimumRentalHours: product.minimumRentalHoursOverride ?? settings.minimumRentalHours,
  };
}

/**
 * Pick the best-value pricing tier(s) for a given duration and compute the
 * rental subtotal. Falls back to the smallest defined unit if no exact
 * duration match exists (bills in whole units, rounding up).
 */
function calculateRentalPrice(product, startDate, endDate, quantity = 1) {
  if (!product.pricingTiers || product.pricingTiers.length === 0) {
    throw new Error("Product has no pricing tiers configured");
  }

  const durationMs = new Date(endDate) - new Date(startDate);
  if (durationMs <= 0) throw new Error("endDate must be after startDate");

  const durationHours = durationMs / MS_PER_HOUR;

  // unit priority: month > week > day > hour, pick the largest unit whose
  // tier duration fits, otherwise fall back to the smallest available unit.
  const unitHoursMap = { hour: 1, day: 24, week: 24 * 7, month: 24 * 30 };
  const sortedTiers = [...product.pricingTiers].sort(
    (a, b) => unitHoursMap[b.unit] * b.duration - unitHoursMap[a.unit] * a.duration
  );

  let chosenTier = null;
  for (const tier of sortedTiers) {
    const tierHours = unitHoursMap[tier.unit] * tier.duration;
    if (durationHours >= tierHours) {
      chosenTier = tier;
      break;
    }
  }
  if (!chosenTier) {
    // shortest tier available, bill by ceil(units)
    chosenTier = sortedTiers[sortedTiers.length - 1];
  }

  const tierHours = unitHoursMap[chosenTier.unit] * chosenTier.duration;
  const billedUnits = Math.max(1, Math.ceil(durationHours / tierHours));
  const rentalSubtotal = billedUnits * chosenTier.price * quantity;

  return {
    unit: chosenTier.unit,
    unitPrice: chosenTier.price,
    billedUnits,
    rentalSubtotal: round2(rentalSubtotal),
  };
}

/**
 * Check whether `quantity` units of `product` are free for [startDate, endDate],
 * accounting for existing overlapping rentals plus each rental's padding buffer.
 */
async function checkAvailability(product, startDate, endDate, quantity, settings, excludeRentalId = null) {
  const rules = resolveEffectiveRules(product, settings);
  const paddingMs = rules.paddingMinutes * MS_PER_MINUTE;

  const query = {
    product: product._id,
    status: { $nin: ["CANCELLED", "COMPLETED"] },
  };
  if (excludeRentalId) query._id = { $ne: excludeRentalId };

  const overlapping = await Rental.find(query).select("startAt expectedReturnAt actualReturnAt quantity status");

  // requested window, padded on both sides so we don't butt up against
  // another rental's cleaning/maintenance buffer
  const reqStart = new Date(startDate).getTime();
  const reqEnd = new Date(endDate).getTime();

  let reservedQty = 0;
  for (const r of overlapping) {
    const existingEnd = (r.actualReturnAt ? new Date(r.actualReturnAt) : new Date(r.expectedReturnAt)).getTime() + paddingMs;
    const existingStart = new Date(r.startAt).getTime();

    const overlaps = reqStart < existingEnd && reqEnd > existingStart;
    if (overlaps) reservedQty += r.quantity;
  }

  const availableQty = product.totalQuantity - reservedQty;
  return {
    available: availableQty >= quantity,
    availableQty,
    requestedQty: quantity,
  };
}

/** Reject bookings that start/end on admin-configured unavailable days. */
function checkUnavailableDays(date, settings) {
  const d = new Date(date);
  const weekday = d.getDay();
  if (settings.unavailableWeekdays.includes(weekday)) {
    return { blocked: true, reason: "Selected weekday is unavailable for pickup/return" };
  }
  const dateOnly = d.toISOString().slice(0, 10);
  const isHoliday = settings.unavailableDates.some((h) => new Date(h).toISOString().slice(0, 10) === dateOnly);
  if (isHoliday) {
    return { blocked: true, reason: "Selected date is a configured holiday" };
  }
  return { blocked: false };
}

/**
 * Compute delay between expected and actual return, apply grace period,
 * then bill hourly until dailySwitchHours is crossed, after which bill daily.
 * This is the single source of truth for late fees - the frontend must
 * never send a late fee amount.
 */
function calculateLateFee(expectedReturnAt, actualReturnAt, product, settings) {
  const rules = resolveEffectiveRules(product, settings);

  const expected = new Date(expectedReturnAt).getTime();
  const actual = new Date(actualReturnAt).getTime();
  const rawDelayMs = actual - expected;

  if (rawDelayMs <= 0) {
    return {
      gracePeriodMinutes: rules.gracePeriodMinutes,
      delayMinutes: 0,
      billableDelayUnits: 0,
      billingType: null,
      amount: 0,
    };
  }

  const graceMs = rules.gracePeriodMinutes * MS_PER_MINUTE;
  const billableMs = Math.max(0, rawDelayMs - graceMs);
  const delayMinutes = Math.round(rawDelayMs / MS_PER_MINUTE);

  if (billableMs === 0) {
    return {
      gracePeriodMinutes: rules.gracePeriodMinutes,
      delayMinutes,
      billableDelayUnits: 0,
      billingType: null,
      amount: 0,
    };
  }

  const billableHours = billableMs / MS_PER_HOUR;

  let amount;
  let billingType;
  let billableUnits;

  if (billableHours > rules.dailySwitchHours) {
    billableUnits = Math.ceil(billableHours / 24);
    amount = billableUnits * rules.dailyFee;
    billingType = "daily";
  } else {
    billableUnits = Math.ceil(billableHours);
    amount = billableUnits * rules.hourlyFee;
    billingType = "hourly";
  }

  amount = Math.min(amount, rules.maximumFee);

  return {
    gracePeriodMinutes: rules.gracePeriodMinutes,
    delayMinutes,
    billableDelayUnits: billableUnits,
    billingType,
    amount: round2(amount),
  };
}

/** Deposit refund = deposit - lateFee - damageDeduction, floored at 0. */
function calculateRefund(depositAmount, lateFeeAmount = 0, damageDeduction = 0) {
  const refundable = depositAmount - lateFeeAmount - damageDeduction;
  const refundableAmount = Math.max(0, round2(refundable));
  let status;
  if (refundableAmount === 0 && depositAmount > 0) status = "DEDUCTED";
  else if (refundableAmount < depositAmount) status = "PARTIALLY_REFUNDED";
  else status = "REFUNDED";
  return { refundableAmount, status };
}

/** Enforce minimum rental duration configured globally or per product. */
function checkMinimumDuration(startDate, endDate, product, settings) {
  const rules = resolveEffectiveRules(product, settings);
  const durationHours = (new Date(endDate) - new Date(startDate)) / MS_PER_HOUR;
  return {
    valid: durationHours >= rules.minimumRentalHours,
    minimumRentalHours: rules.minimumRentalHours,
    requestedHours: round2(durationHours),
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = {
  getSettings,
  resolveEffectiveRules,
  calculateRentalPrice,
  checkAvailability,
  checkUnavailableDays,
  calculateLateFee,
  calculateRefund,
  checkMinimumDuration,
};
