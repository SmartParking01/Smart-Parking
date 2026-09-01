const { query } = require("../config/db");

const EntryModel = {
  async create({ reservationId = null, spaceId, establishmentId, userId = null, guardId, source }) {
    const { rows } = await query(
      `INSERT INTO entries (reservation_id, space_id, establishment_id, user_id, guard_id, source)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [reservationId, spaceId, establishmentId, userId, guardId, source]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await query("SELECT * FROM entries WHERE id = $1", [id]);
    return rows[0] || null;
  },

  // Encuentra la entrada abierta (sin salida registrada) de un espacio.
  async findOpenBySpace(spaceId) {
    const { rows } = await query(
      "SELECT * FROM entries WHERE space_id = $1 AND exit_time IS NULL ORDER BY entry_time DESC LIMIT 1",
      [spaceId]
    );
    return rows[0] || null;
  },

  async registerExit(id) {
    await query("UPDATE entries SET exit_time = NOW() WHERE id = $1", [id]);
    return this.findById(id);
  },

  async listByEstablishment(establishmentId, { onlyOpen = false } = {}) {
    const base = `
      SELECT en.*, s.code as space_code, u.name as user_name
      FROM entries en
      JOIN parking_spaces s ON s.id = en.space_id
      LEFT JOIN users u ON u.id = en.user_id
      WHERE en.establishment_id = $1
    `;
    const sql = onlyOpen
      ? `${base} AND en.exit_time IS NULL ORDER BY en.entry_time DESC`
      : `${base} ORDER BY en.entry_time DESC`;
    const { rows } = await query(sql, [establishmentId]);
    return rows;
  },

  // Historial de un usuario específico
  async listByUser(userId) {
    const { rows } = await query(
      `SELECT en.*, s.code as space_code, e.name as establishment_name
       FROM entries en
       JOIN parking_spaces s ON s.id = en.space_id
       JOIN establishments e ON e.id = en.establishment_id
       WHERE en.user_id = $1
       ORDER BY en.entry_time DESC`,
      [userId]
    );
    return rows;
  },

  // Estadísticas: ocupación por hora del día (0-23) para un establecimiento
  async occupancyByHour(establishmentId) {
    const { rows } = await query(
      `SELECT EXTRACT(HOUR FROM entry_time)::int as hour, COUNT(*)::int as entries_count
       FROM entries
       WHERE establishment_id = $1
       GROUP BY hour
       ORDER BY hour`,
      [establishmentId]
    );
    return rows;
  },

  // Estadísticas: ocupación por día de la semana (0=domingo)
  async occupancyByWeekday(establishmentId) {
    const { rows } = await query(
      `SELECT EXTRACT(DOW FROM entry_time)::int as weekday, COUNT(*)::int as entries_count
       FROM entries
       WHERE establishment_id = $1
       GROUP BY weekday
       ORDER BY weekday`,
      [establishmentId]
    );
    return rows;
  },
};

module.exports = EntryModel;
