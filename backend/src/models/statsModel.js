const { query } = require("../config/db");

const StatsModel = {
  // Entradas agrupadas por hora del día (0-23), sumando todos los parqueos
  // del establecimiento, a partir de la vista v_entries_by_hour.
  async entriesByHour(establishmentId) {
    const { rows } = await query(
      `SELECT EXTRACT(HOUR FROM hour_bucket)::int AS hour, SUM(entries)::int AS entries_count
       FROM v_entries_by_hour
       WHERE parking_id IN (SELECT id FROM parkings WHERE establishment_id = $1)
       GROUP BY hour
       ORDER BY hour`,
      [establishmentId]
    );
    return rows;
  },

  async entriesByWeekday(establishmentId) {
    const { rows } = await query(
      `SELECT EXTRACT(DOW FROM hour_bucket)::int AS weekday, SUM(entries)::int AS entries_count
       FROM v_entries_by_hour
       WHERE parking_id IN (SELECT id FROM parkings WHERE establishment_id = $1)
       GROUP BY weekday
       ORDER BY weekday`,
      [establishmentId]
    );
    return rows;
  },
};

module.exports = StatsModel;
