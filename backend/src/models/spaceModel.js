const { query } = require("../config/db");

const SpaceModel = {
  async create({ establishmentId, code, rowLabel }) {
    const { rows } = await query(
      `INSERT INTO parking_spaces (establishment_id, code, row_label)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [establishmentId, code, rowLabel || null]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await query("SELECT * FROM parking_spaces WHERE id = $1", [id]);
    return rows[0] || null;
  },

  // Con better-sqlite3 (síncrono) esto bastaba porque no había condiciones de
  // carrera dentro del mismo proceso. Con Postgres, la operación realmente
  // atómica para reservar/ocupar un espacio es compareAndSetStatus (UPDATE
  // condicionado), no esta lectura. Se mantiene por compatibilidad con el
  // resto del código, pero para bloqueo real de fila usar
  // "SELECT ... FOR UPDATE" dentro de una transacción si se necesita.
  async findByIdForUpdate(id) {
    return this.findById(id);
  },

  async listByEstablishment(establishmentId) {
    const { rows } = await query(
      "SELECT * FROM parking_spaces WHERE establishment_id = $1 ORDER BY row_label, code",
      [establishmentId]
    );
    return rows;
  },

  async updateStatus(id, status) {
    await query("UPDATE parking_spaces SET status = $1 WHERE id = $2", [status, id]);
    return this.findById(id);
  },

  // Cambia el estado solo si el estado actual coincide con el esperado.
  // Devuelve true si el cambio se aplicó (evita reservas/asignaciones dobles).
  async compareAndSetStatus(id, expectedStatus, newStatus) {
    const result = await query(
      "UPDATE parking_spaces SET status = $1 WHERE id = $2 AND status = $3",
      [newStatus, id, expectedStatus]
    );
    return result.rowCount === 1;
  },

  async setBlocked(id, blocked) {
    const status = blocked ? "BLOCKED" : "AVAILABLE";
    return this.updateStatus(id, status);
  },

  async delete(id) {
    await query("DELETE FROM parking_spaces WHERE id = $1", [id]);
  },
};

module.exports = SpaceModel;
