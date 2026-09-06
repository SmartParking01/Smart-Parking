const { query } = require("../config/db");

const CompanyModel = {
  async create({ name, taxId, email, phone, address }) {
    const { rows } = await query(
      `INSERT INTO companies (name, tax_id, email, phone, address)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, taxId, email || null, phone || null, address || null]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await query("SELECT * FROM companies WHERE id = $1", [id]);
    return rows[0] || null;
  },

  async listAll() {
    const { rows } = await query("SELECT * FROM companies ORDER BY name");
    return rows;
  },
};

module.exports = CompanyModel;
