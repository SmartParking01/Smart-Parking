const { query } = require("../config/db");
const RoleModel = require("./roleModel");

const UserModel = {
  async create({ firstName, lastName, email, phone, passwordHash }) {
    const { rows } = await query(
      `INSERT INTO users (first_name, last_name, email, phone, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [firstName, lastName, email, phone || null, passwordHash]
    );
    return rows[0];
  },

  async findByEmail(email) {
    const { rows } = await query("SELECT * FROM users WHERE email = $1", [email]);
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await query("SELECT * FROM users WHERE id = $1", [id]);
    return rows[0] || null;
  },

  async updatePassword(id, passwordHash) {
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, id]);
  },

  // Asigna un rol a un usuario, opcionalmente acotado a una empresa/establecimiento
  // (así es como un ATTENDANT o ADMIN queda ligado a un sitio concreto).
  async assignRole(userId, roleName, { companyId = null, establishmentId = null } = {}) {
    const role = await RoleModel.findByName(roleName);
    if (!role) throw new Error(`El rol "${roleName}" no existe en el catálogo de roles.`);
    const { rows } = await query(
      `INSERT INTO user_roles (user_id, role_id, company_id, establishment_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, role_id, company_id, establishment_id) DO NOTHING
       RETURNING *`,
      [userId, role.id, companyId, establishmentId]
    );
    return rows[0] || null;
  },

  // Todos los roles/alcances que tiene un usuario.
  async getRoles(userId) {
    const { rows } = await query(
      `SELECT ur.id, r.name AS role_name, ur.company_id, ur.establishment_id, ur.assigned_at
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1
       ORDER BY ur.assigned_at ASC`,
      [userId]
    );
    return rows;
  },

  // Rol "principal" para simplificar el login/JWT: el primero que se le asignó.
  // Para este proyecto se asume un rol operativo por usuario.
  async getPrimaryRole(userId) {
    const roles = await this.getRoles(userId);
    return roles[0] || null;
  },

  async listByEstablishment(establishmentId) {
    const { rows } = await query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.status, u.created_at,
              r.name AS role_name
       FROM user_roles ur
       JOIN users u ON u.id = ur.user_id
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.establishment_id = $1`,
      [establishmentId]
    );
    return rows;
  },

  async listAll() {
    const { rows } = await query(
      `SELECT id, first_name, last_name, email, phone, status, created_at FROM users ORDER BY created_at DESC`
    );
    return rows;
  },

  toPublic(user, roleInfo = null) {
    if (!user) return null;
    const { password_hash, ...publicUser } = user;
    if (roleInfo) {
      publicUser.role = roleInfo.role_name;
      publicUser.companyId = roleInfo.company_id;
      publicUser.establishmentId = roleInfo.establishment_id;
    }
    return publicUser;
  },
};

module.exports = UserModel;
