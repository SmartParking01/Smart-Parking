const EntryModel = require("../models/entryModel");
const EstablishmentModel = require("../models/establishmentModel");

/**
 * Calcula estadísticas de ocupación actuales y una predicción simple por hora
 * a partir del historial de entradas. Esta predicción es una funcionalidad
 * adicional (sección 13 del prompt) y no bloquea el MVP si hay poco historial.
 */
async function currentSummary(establishmentId) {
  return EstablishmentModel.availabilitySummary(establishmentId);
}

function occupancyRatePercent(summary) {
  if (summary.TOTAL === 0) return 0;
  const used = summary.OCCUPIED + summary.RESERVED;
  return Math.round((used / summary.TOTAL) * 10000) / 100; // 2 decimales
}

function classifyLevel(avgEntries, maxEntries) {
  if (maxEntries === 0) return "BAJA";
  const ratio = avgEntries / maxEntries;
  if (ratio >= 0.66) return "ALTA";
  if (ratio >= 0.33) return "MEDIA";
  return "BAJA";
}

/**
 * Predicción básica: promedia cuántas entradas históricas hubo por hora
 * y clasifica cada hora como ALTA / MEDIA / BAJA ocupación relativa.
 */
async function predictOccupancyByHour(establishmentId) {
  const rows = await EntryModel.occupancyByHour(establishmentId);
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
  const rows = await EntryModel.occupancyByWeekday(establishmentId);
  return rows.map((r) => ({ weekday: r.weekday, name: names[r.weekday], entriesHistorically: r.entries_count }));
}

module.exports = { currentSummary, occupancyRatePercent, predictOccupancyByHour, weekdaySummary };
