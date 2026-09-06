const { query } = require("../config/db");

const RoleModel = {
  async findByName(name) {
    const { rows } = await query("SELECT * FROM roles WHERE name = $1", [name]);
    return rows[0] || null;
  },

  async listAll() {
    const { rows } = await query("SELECT * FROM roles ORDER BY name");
    return rows;
  },
};

module.exports = RoleModel;
