const { query } = require("../config/db");

// "Sesión de parqueo" = una entrada/salida (tabla parking_sessions).
const SessionModel = {
  async create({ reservationId = null, spaceId, userId = null, attendantId, entryMethod }) {
    const { rows } = await query(
      `INSERT INTO parking_sessions (reservation_id, space_id, user_id, attendant_id, entry_method)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [reservationId, spaceId, userId, attendantId, entryMethod]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await query("SELECT * FROM parking_sessions WHERE id = $1", [id]);
    return rows[0] || null;
  },

  async findOpenBySpace(spaceId) {
    const { rows } = await query(
      "SELECT * FROM parking_sessions WHERE space_id = $1 AND status = 'OPEN' LIMIT 1",
      [spaceId]
    );
    return rows[0] || null;
  },

  // El trigger trg_release_space_on_exit ya libera el espacio y cierra la
  // sesión (status -> CLOSED) al ponerle exit_time; y si tenía reserva,
  // la marca COMPLETED. Aquí solo disparamos el UPDATE.
  async registerExit(id, exitMethod) {
    const { rows } = await query(
      "UPDATE parking_sessions SET exit_time = now(), exit_method = $1 WHERE id = $2 RETURNING *",
      [exitMethod, id]
    );
    return rows[0] || null;
  },

  async listOpenByEstablishment(establishmentId) {
    const { rows } = await query(
      `SELECT * FROM v_vehicles_inside
       WHERE parking_id IN (SELECT id FROM parkings WHERE establishment_id = $1)
       ORDER BY entry_time DESC`,
      [establishmentId]
    );
    return rows;
  },

  async listByEstablishment(establishmentId) {
    const { rows } = await query(
      `SELECT * FROM v_usage_history
       WHERE parking_id IN (SELECT id FROM parkings WHERE establishment_id = $1)
       ORDER BY entry_time DESC`,
      [establishmentId]
    );
    return rows;
  },

  async listByUser(userId) {
    const { rows } = await query("SELECT * FROM v_usage_history WHERE user_id = $1 ORDER BY entry_time DESC", [
      userId,
    ]);
    return rows;
  },
};

module.exports = SessionModel;
