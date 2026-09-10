const { query } = require("../config/db");

const ParkingModel = {
  async create({ establishmentId, name, capacity, openingTime, closingTime }) {
    const { rows } = await query(
      `INSERT INTO parkings (establishment_id, name, capacity, opening_time, closing_time)
       VALUES ($1, $2, $3, COALESCE($4, '00:00'::time), COALESCE($5, '23:59'::time))
       RETURNING *`,
      [establishmentId, name, capacity, openingTime, closingTime]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await query("SELECT * FROM parkings WHERE id = $1", [id]);
    return rows[0] || null;
  },

  async listByEstablishment(establishmentId) {
    const { rows } = await query(
      "SELECT * FROM parkings WHERE establishment_id = $1 ORDER BY name",
      [establishmentId]
    );
    return rows;
  },
};

module.exports = ParkingModel;
