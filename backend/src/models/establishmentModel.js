const { query } = require("../config/db");

const EstablishmentModel = {
  async create({ name, type, address, rules, createdBy }) {
    const { rows } = await query(
      `INSERT INTO establishments (name, type, address, rules, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, type, address, rules || "", createdBy]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await query("SELECT * FROM establishments WHERE id = $1", [id]);
    return rows[0] || null;
  },

  async listAll() {
    const { rows } = await query("SELECT * FROM establishments ORDER BY name");
    return rows;
  },

  async update(id, { name, type, address, rules }) {
    await query(
      `UPDATE establishments SET name = COALESCE($1, name), type = COALESCE($2, type),
       address = COALESCE($3, address), rules = COALESCE($4, rules) WHERE id = $5`,
      [name, type, address, rules, id]
    );
    return this.findById(id);
  },

  // Cuenta espacios por estado para un establecimiento (para disponibilidad rápida)
  async availabilitySummary(id) {
    const { rows } = await query(
      `SELECT status, COUNT(*)::int as count FROM parking_spaces WHERE establishment_id = $1 GROUP BY status`,
      [id]
    );
    const summary = { AVAILABLE: 0, RESERVED: 0, OCCUPIED: 0, BLOCKED: 0, TOTAL: 0 };
    for (const row of rows) {
      summary[row.status] = row.count;
      summary.TOTAL += row.count;
    }
    return summary;
  },
};

module.exports = EstablishmentModel;
