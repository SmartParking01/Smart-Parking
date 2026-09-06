const StatsModel = require("../models/statsModel");
const EstablishmentModel = require("../models/establishmentModel");

async function currentSummary(establishmentId) {
  return EstablishmentModel.availabilitySummary(establishmentId);
}

function occupancyRatePercent(summary) {
  if (summary.TOTAL === 0) return 0;
  const used = summary.OCCUPIED + summary.RESERVED;
  return Math.round((used / summary.TOTAL) * 10000) / 100;
}

function classifyLevel(avgEntries, maxEntries) {
  if (maxEntries === 0) return "BAJA";
  const ratio = avgEntries / maxEntries;
  if (ratio >= 0.66) return "ALTA";
  if (ratio >= 0.33) return "MEDIA";
  return "BAJA";
}

async function predictOccupancyByHour(establishmentId) {
  const rows = await StatsModel.entriesByHour(establishmentId);
  if (rows.length === 0) {
    return { available: false, message: "Historial insuficiente para generar una predicción.", hours: [] };
  }
  const maxEntries = Math.max(...rows.map((r) => r.entries_count));
  const hours = rows.map((r) => ({
    hour: r.hour,
    label: `${String(r.hour).padStart(2, "0")}:00`,
    entriesHistorically: r.entries_count,
    level: classifyLevel(r.entries_count, maxEntries),
  }));
  return { available: true, hours };
}

async function weekdaySummary(establishmentId) {
  const names = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const rows = await StatsModel.entriesByWeekday(establishmentId);
  return rows.map((r) => ({ weekday: r.weekday, name: names[r.weekday], entriesHistorically: r.entries_count }));
}

module.exports = { currentSummary, occupancyRatePercent, predictOccupancyByHour, weekdaySummary };
