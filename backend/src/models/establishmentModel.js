const { query } = require("../config/db");

const EstablishmentModel = {
  async create({ companyId, name, address, description, latitude, longitude }) {
    const { rows } = await query(
      `INSERT INTO establishments (company_id, name, address, description, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [companyId, name, address || null, description || null, latitude ?? null, longitude ?? null]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await query("SELECT * FROM establishments WHERE id = $1", [id]);
    return rows[0] || null;
  },

  async listAll() {
    const { rows } = await query(
      `SELECT e.*, c.name AS company_name
       FROM establishments e
       JOIN companies c ON c.id = e.company_id
       ORDER BY e.name`
    );
    return rows;
  },

  async listByCompany(companyId) {
    const { rows } = await query("SELECT * FROM establishments WHERE company_id = $1 ORDER BY name", [
      companyId,
    ]);
    return rows;
  },

  async update(id, { name, address, description, latitude, longitude }) {
    await query(
      `UPDATE establishments SET name = COALESCE($1, name), address = COALESCE($2, address),
       description = COALESCE($3, description), latitude = COALESCE($4, latitude),
       longitude = COALESCE($5, longitude) WHERE id = $6`,
      [name, address, description, latitude, longitude, id]
    );
    return this.findById(id);
  },

  // Disponibilidad agregada de TODOS los parqueos de un establecimiento,
  // usando la vista v_parking_capacity que ya existe en el esquema.
  async availabilitySummary(establishmentId) {
    const { rows } = await query(
      `SELECT
         COALESCE(SUM(total_spaces), 0)::int AS total,
         COALESCE(SUM(available_spaces), 0)::int AS available,
         COALESCE(SUM(reserved_spaces), 0)::int AS reserved,
         COALESCE(SUM(occupied_spaces), 0)::int AS occupied,
         COALESCE(SUM(blocked_spaces), 0)::int AS blocked
       FROM v_parking_capacity
       WHERE parking_id IN (SELECT id FROM parkings WHERE establishment_id = $1)`,
      [establishmentId]
    );
    const r = rows[0];
    return {
      TOTAL: r.total,
      AVAILABLE: r.available,
      RESERVED: r.reserved,
      OCCUPIED: r.occupied,
      BLOCKED: r.blocked,
    };
  },
};

module.exports = EstablishmentModel;
