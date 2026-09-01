const statsService = require("../services/statsService");
const { ok, fail } = require("../utils/response");

async function summary(req, res) {
  const establishmentId = req.params.establishmentId;
  const current = await statsService.currentSummary(establishmentId);
  const occupancyRate = statsService.occupancyRatePercent(current);
  return ok(res, { current, occupancyRatePercent: occupancyRate });
}

async function prediction(req, res) {
  const establishmentId = req.params.establishmentId;
  const byHour = await statsService.predictOccupancyByHour(establishmentId);
  const byWeekday = await statsService.weekdaySummary(establishmentId);
  return ok(res, { prediction: byHour, weekdayHistory: byWeekday });
}

module.exports = { summary, prediction };
