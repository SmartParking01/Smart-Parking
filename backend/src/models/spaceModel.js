const { query } = require("../config/db");

const SpaceModel = {
  async create({ parkingId, code, type, rowLocation }) {
    const { rows } = await query(
      `INSERT INTO parking_spaces (parking_id, code, type, row_location)
       VALUES ($1, $2, COALESCE($3, 'REGULAR'::space_type_t), $4)
       RETURNING *`,
      [parkingId, code, type, rowLocation || null]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await query("SELECT * FROM parking_spaces WHERE id = $1", [id]);
    return rows[0] || null;
  },

  async listByParking(parkingId) {
    const { rows } = await query(
      "SELECT * FROM parking_spaces WHERE parking_id = $1 ORDER BY row_location, code",
      [parkingId]
    );
    return rows;
  },

  // Mapa completo de un establecimiento (todos sus parqueos y espacios).
  async listByEstablishment(establishmentId) {
    const { rows } = await query(
      `SELECT sp.*, p.name AS parking_name
       FROM parking_spaces sp
       JOIN parkings p ON p.id = sp.parking_id
       WHERE p.establishment_id = $1
       ORDER BY p.name, sp.row_location, sp.code`,
      [establishmentId]
    );
    return rows;
  },

  async updateStatus(id, status) {
    const { rows } = await query(
      "UPDATE parking_spaces SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );
    return rows[0] || null;
  },

  // Cambia el estado solo si coincide con el esperado (para asignación manual
  // sin reserva, que no está protegida por el EXCLUDE constraint). Las
  // reservas normales NO necesitan esto: el trigger + el EXCLUDE constraint
  // ya garantizan la atomicidad.
  async compareAndSetStatus(id, expectedStatus, newStatus) {
    const result = await query(
      "UPDATE parking_spaces SET status = $1 WHERE id = $2 AND status = $3",
      [newStatus, id, expectedStatus]
    );
    return result.rowCount === 1;
  },

  async setBlocked(id, blocked) {
    return this.updateStatus(id, blocked ? "BLOCKED" : "AVAILABLE");
  },

  async delete(id) {
    await query("DELETE FROM parking_spaces WHERE id = $1", [id]);
  },
};

module.exports = SpaceModel;
