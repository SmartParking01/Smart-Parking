const { query } = require("../config/db");

const QrModel = {
  async create({ reservationId, token, expiresAt }) {
    const { rows } = await query(
      `INSERT INTO qr_codes (reservation_id, token, expires_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [reservationId, token, expiresAt]
    );
    return rows[0];
  },

  async findByToken(token) {
    const { rows } = await query("SELECT * FROM qr_codes WHERE token = $1", [token]);
    return rows[0] || null;
  },

  async findValidByReservation(reservationId) {
    const { rows } = await query(
      "SELECT * FROM qr_codes WHERE reservation_id = $1 AND status = 'VALID' LIMIT 1",
      [reservationId]
    );
    return rows[0] || null;
  },

  async markUsed(id) {
    const { rows } = await query("UPDATE qr_codes SET status = 'USED' WHERE id = $1 RETURNING *", [id]);
    return rows[0] || null;
  },

  async markExpired(id) {
    const { rows } = await query("UPDATE qr_codes SET status = 'EXPIRED' WHERE id = $1 RETURNING *", [id]);
    return rows[0] || null;
  },

  async markRevoked(id) {
    const { rows } = await query("UPDATE qr_codes SET status = 'REVOKED' WHERE id = $1 RETURNING *", [id]);
    return rows[0] || null;
  },
};

module.exports = QrModel;
