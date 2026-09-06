const crypto = require("crypto");
const { query } = require("../config/db");

function generateReservationCode() {
  return `RES-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

const ReservationModel = {
  // No hace falta manejar manualmente el estado del espacio: el trigger
  // trg_sync_space_status_from_reservation ya lo hace (CONFIRMED -> RESERVED,
  // ACTIVE -> OCCUPIED, CANCELLED/EXPIRED/COMPLETED -> AVAILABLE). Tampoco
  // hace falta un compareAndSet: el EXCLUDE constraint (excl_reservation_no_overlap)
  // rechaza la reserva a nivel de base de datos si el espacio ya está
  // comprometido en ese rango de tiempo, incluso ante solicitudes simultáneas.
  async create({ userId, spaceId, parkingId, startTime, endTime, status = "CONFIRMED" }) {
    const reservationCode = generateReservationCode();
    const { rows } = await query(
      `INSERT INTO reservations (user_id, space_id, parking_id, reservation_code, start_time, end_time, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, spaceId, parkingId, reservationCode, startTime, endTime, status]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await query("SELECT * FROM reservations WHERE id = $1", [id]);
    return rows[0] || null;
  },

  async listByUser(userId) {
    const { rows } = await query(
      `SELECT r.*, sp.code AS space_code, p.name AS parking_name
       FROM reservations r
       JOIN parking_spaces sp ON sp.id = r.space_id
       JOIN parkings p ON p.id = r.parking_id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );
    return rows;
  },

  async listByEstablishment(establishmentId, status = null) {
    const base = `
      SELECT r.*, u.email AS user_email, sp.code AS space_code, p.name AS parking_name
      FROM reservations r
      JOIN users u ON u.id = r.user_id
      JOIN parking_spaces sp ON sp.id = r.space_id
      JOIN parkings p ON p.id = r.parking_id
      WHERE p.establishment_id = $1
    `;
    if (status) {
      const { rows } = await query(`${base} AND r.status = $2 ORDER BY r.created_at DESC`, [
        establishmentId,
        status,
      ]);
      return rows;
    }
    const { rows } = await query(`${base} ORDER BY r.created_at DESC`, [establishmentId]);
    return rows;
  },

  async updateStatus(id, status) {
    const { rows } = await query(
      "UPDATE reservations SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );
    return rows[0] || null;
  },

  // Marca como EXPIRED las reservas vencidas que nunca se usaron; el trigger
  // libera el espacio automáticamente al cambiar el estado.
  async expireOverdue() {
    const { rows } = await query(
      `UPDATE reservations SET status = 'EXPIRED'
       WHERE status IN ('PENDING', 'CONFIRMED') AND end_time < now()
       RETURNING *`
    );
    return rows;
  },
};

module.exports = ReservationModel;
