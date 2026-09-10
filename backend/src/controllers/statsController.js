const statsService = require("../services/statsService");
const { ok } = require("../utils/response");

async function summary(req, res) {
  const current = await statsService.currentSummary(req.params.establishmentId);
  const occupancyRate = statsService.occupancyRatePercent(current);
  return ok(res, { current, occupancyRatePercent: occupancyRate });
}

async function prediction(req, res) {
  const byHour = await statsService.predictOccupancyByHour(req.params.establishmentId);
  const byWeekday = await statsService.weekdaySummary(req.params.establishmentId);
  return ok(res, { prediction: byHour, weekdayHistory: byWeekday });
}

module.exports = { summary, prediction };
