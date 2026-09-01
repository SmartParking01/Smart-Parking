const { query } = require("../config/db");

const ReservationModel = {
  async create({ userId, establishmentId, spaceId, qrToken, expiresAtIso }) {
    const { rows } = await query(
      `INSERT INTO reservations (user_id, establishment_id, space_id, qr_token, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, establishmentId, spaceId, qrToken, expiresAtIso]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await query("SELECT * FROM reservations WHERE id = $1", [id]);
    return rows[0] || null;
  },

  async findByToken(token) {
    const { rows } = await query("SELECT * FROM reservations WHERE qr_token = $1", [token]);
    return rows[0] || null;
  },

  async listByUser(userId) {
    const { rows } = await query(
      `SELECT r.*, s.code as space_code, e.name as establishment_name
       FROM reservations r
       JOIN parking_spaces s ON s.id = r.space_id
       JOIN establishments e ON e.id = r.establishment_id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );
    return rows;
  },

  async listByEstablishment(establishmentId, status = null) {
    if (status) {
      const { rows } = await query(
        `SELECT r.*, u.name as user_name, s.code as space_code
         FROM reservations r
         JOIN users u ON u.id = r.user_id
         JOIN parking_spaces s ON s.id = r.space_id
         WHERE r.establishment_id = $1 AND r.status = $2
         ORDER BY r.created_at DESC`,
        [establishmentId, status]
      );
      return rows;
    }
    const { rows } = await query(
      `SELECT r.*, u.name as user_name, s.code as space_code
       FROM reservations r
       JOIN users u ON u.id = r.user_id
       JOIN parking_spaces s ON s.id = r.space_id
       WHERE r.establishment_id = $1
       ORDER BY r.created_at DESC`,
      [establishmentId]
    );
    return rows;
  },

  async updateStatus(id, status, extra = {}) {
    const fields = ["status = $1"];
    const params = [status];
    let idx = 2;
    if (extra.usedAtIso) {
      fields.push(`used_at = $${idx}`);
      params.push(extra.usedAtIso);
      idx += 1;
    }
    params.push(id);
    await query(`UPDATE reservations SET ${fields.join(", ")} WHERE id = $${idx}`, params);
    return this.findById(id);
  },

  // Marca como EXPIRED cualquier reserva ACTIVE cuyo tiempo ya pasó.
  // Devuelve la lista de reservas recién expiradas (para liberar sus espacios).
  async expireOverdue() {
    const { rows: overdue } = await query(
      "SELECT * FROM reservations WHERE status = 'ACTIVE' AND expires_at < NOW()"
    );
    if (overdue.length > 0) {
      const ids = overdue.map((r) => r.id);
      await query("UPDATE reservations SET status = 'EXPIRED' WHERE id = ANY($1::int[])", [ids]);
    }
    return overdue;
  },
};

module.exports = ReservationModel;
