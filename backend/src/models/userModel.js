const { query } = require("../config/db");

const UserModel = {
  async create({ name, email, phone, passwordHash, role = "USER", establishmentId = null }) {
    const { rows } = await query(
      `INSERT INTO users (name, email, phone, password_hash, role, establishment_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, email, phone, passwordHash, role, establishmentId]
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

  async setResetToken(id, token, expiresAtIso) {
    await query("UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3", [
      token,
      expiresAtIso,
      id,
    ]);
  },

  async findByResetToken(token) {
    const { rows } = await query("SELECT * FROM users WHERE reset_token = $1", [token]);
    return rows[0] || null;
  },

  async updatePassword(id, passwordHash) {
    await query(
      "UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2",
      [passwordHash, id]
    );
  },

  async listByEstablishment(establishmentId) {
    const { rows } = await query(
      "SELECT id, name, email, phone, role, created_at FROM users WHERE establishment_id = $1",
      [establishmentId]
    );
    return rows;
  },

  async listAll() {
    const { rows } = await query(
      "SELECT id, name, email, phone, role, establishment_id, created_at FROM users"
    );
    return rows;
  },

  toPublic(user) {
    if (!user) return null;
    const { password_hash, reset_token, reset_token_expires, ...publicUser } = user;
    return publicUser;
  },
};

module.exports = UserModel;
