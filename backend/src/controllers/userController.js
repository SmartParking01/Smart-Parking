const bcrypt = require("bcryptjs");
const UserModel = require("../models/userModel");
const EstablishmentModel = require("../models/establishmentModel");
const { ok, fail } = require("../utils/response");

// El ADMIN crea cuentas de personal (SECURITY o ADMIN) ya asignadas a un establecimiento.
async function createStaff(req, res) {
  const { name, email, phone, password, role, establishmentId } = req.body;

  if (!name || !email || !password || !role || !establishmentId) {
    return fail(res, "name, email, password, role y establishmentId son obligatorios.");
  }
  if (!["SECURITY", "ADMIN"].includes(role)) {
    return fail(res, "El rol debe ser SECURITY o ADMIN.");
  }
  if (!(await EstablishmentModel.findById(establishmentId))) {
    return fail(res, "El establecimiento indicado no existe.", 404);
  }
  if (await UserModel.findByEmail(email)) {
    return fail(res, "Ya existe una cuenta con ese correo.", 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await UserModel.create({ name, email, phone, passwordHash, role, establishmentId });
  return ok(res, { user: UserModel.toPublic(user) }, 201);
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
