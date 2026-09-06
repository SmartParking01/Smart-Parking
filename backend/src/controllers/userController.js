const bcrypt = require("bcryptjs");
const UserModel = require("../models/userModel");
const EstablishmentModel = require("../models/establishmentModel");
const { ok, fail } = require("../utils/response");

// El ADMIN crea cuentas de personal (ATTENDANT o ADMIN) ya asignadas a un establecimiento.
async function createStaff(req, res) {
  const { name, email, phone, password, role, establishmentId } = req.body;

  if (!name || !email || !password || !role || !establishmentId) {
    return fail(res, "name, email, password, role y establishmentId son obligatorios.");
  }
  if (!["ATTENDANT", "ADMIN"].includes(role)) {
    return fail(res, "El rol debe ser ATTENDANT o ADMIN.");
  }
  const establishment = await EstablishmentModel.findById(establishmentId);
  if (!establishment) return fail(res, "El establecimiento indicado no existe.", 404);
  if (await UserModel.findByEmail(email)) return fail(res, "Ya existe una cuenta con ese correo.", 409);

  const parts = name.trim().split(/\s+/);
  const firstName = parts.shift() || name;
  const lastName = parts.join(" ") || "-";

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await UserModel.create({ firstName, lastName, email, phone, passwordHash });
  await UserModel.assignRole(user.id, role, { companyId: establishment.company_id, establishmentId });

  return ok(res, { user: UserModel.toPublic(user, { role_name: role, establishment_id: establishmentId }) }, 201);
}

async function listStaff(req, res) {
  const users = await UserModel.listByEstablishment(req.params.establishmentId);
  return ok(res, { users });
}

async function listUsers(req, res) {
  const users = await UserModel.listAll();
  return ok(res, { users });
}

module.exports = { createStaff, listStaff, listUsers };
