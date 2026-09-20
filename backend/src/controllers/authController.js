const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const UserModel = require("../models/userModel");
const EstablishmentModel = require("../models/establishmentModel");
const { signSessionToken } = require("../utils/jwt");
const { ok, fail } = require("../utils/response");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Dominio reservado para el personal del establecimiento (guardas y
// administradores). Cualquier correo que NO termine en este dominio se
// trata como cliente (USER) automáticamente, sin que nadie tenga que
// asignarle el rol a mano.
const STAFF_DOMAIN = "@smartparking-staff.cr";

// Dentro del dominio de personal, el prefijo del correo decide si es
// ADMIN o ATTENDANT (guarda): admin.nombre@smartparking-staff.cr => ADMIN,
// cualquier otro correo de ese dominio => ATTENDANT.
function detectRoleFromEmail(email) {
  const lower = email.toLowerCase().trim();
  if (!lower.endsWith(STAFF_DOMAIN)) return "USER";
  const localPart = lower.split("@")[0];
  return localPart.startsWith("admin") ? "ADMIN" : "ATTENDANT";
}

// Los tokens de recuperación de contraseña se guardan en memoria del proceso
// (no en la tabla `users`, que no tiene columnas para eso en el esquema real).
// Limitación aceptada para este proyecto: se pierden si el servidor se
// reinicia, y no funcionan si corres varias instancias del backend a la vez.
const passwordResetTokens = new Map(); // token -> { userId, expiresAt }

function splitName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts.shift() || fullName;
  const lastName = parts.join(" ") || "-";
  return { firstName, lastName };
}

async function register(req, res) {
  const { name, email, phone, password, establishmentId } = req.body;

  if (!name || !email || !password) {
    return fail(res, "Nombre, correo y contraseña son obligatorios.");
  }
  if (!EMAIL_REGEX.test(email)) {
    return fail(res, "El formato del correo electrónico no es válido.");
  }
  if (password.length < 6) {
    return fail(res, "La contraseña debe tener al menos 6 caracteres.");
  }
  if (await UserModel.findByEmail(email)) {
    return fail(res, "Ya existe una cuenta con ese correo.", 409);
  }

  // El rol se determina automáticamente por el correo: nadie tiene que
  // asignarlo a mano. Un correo del dominio de personal se vuelve ADMIN o
  // ATTENDANT según su prefijo; cualquier otro correo (Gmail, Hotmail, etc.)
  // queda como cliente (USER).
  const role = detectRoleFromEmail(email);

  // Una cuenta de personal SIEMPRE debe quedar ligada a un establecimiento
  // (y por lo tanto a la empresa dueña de ese establecimiento) — si no, el
  // panel administrativo no tiene de dónde sacar los datos para mostrarle
  // nada a esa persona. Los clientes (USER) no necesitan esto: su alcance
  // es global.
  let companyId = null;
  let scopedEstablishmentId = null;
  if (role !== "USER") {
    if (!establishmentId) {
      return fail(
        res,
        "Las cuentas de personal deben indicar a qué establecimiento pertenecen. Usa la pantalla \"Crear cuenta de personal\" del panel administrativo, que sí pide el establecimiento."
      );
    }
    const establishment = await EstablishmentModel.findById(establishmentId);
    if (!establishment) return fail(res, "El establecimiento indicado no existe.", 404);
    companyId = establishment.company_id;
    scopedEstablishmentId = establishment.id;
  }

  const { firstName, lastName } = splitName(name);
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await UserModel.create({ firstName, lastName, email, phone, passwordHash });
  await UserModel.assignRole(user.id, role, { companyId, establishmentId: scopedEstablishmentId });

  const token = signSessionToken({
    id: user.id,
    role,
    email: user.email,
    companyId,
    establishmentId: scopedEstablishmentId,
  });
  return ok(
    res,
    {
      user: UserModel.toPublic(user, {
        role_name: role,
        company_id: companyId,
        establishment_id: scopedEstablishmentId,
      }),
      token,
    },
    201
  );
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return fail(res, "Correo y contraseña son obligatorios.");
  }

  const user = await UserModel.findByEmail(email);
  if (!user) return fail(res, "Credenciales inválidas.", 401);

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) return fail(res, "Credenciales inválidas.", 401);

  const roleInfo = await UserModel.getPrimaryRole(user.id);
  if (!roleInfo) return fail(res, "Este usuario no tiene ningún rol asignado.", 403);

  const token = signSessionToken({
    id: user.id,
    role: roleInfo.role_name,
    email: user.email,
    companyId: roleInfo.company_id,
    establishmentId: roleInfo.establishment_id,
  });
  return ok(res, { user: UserModel.toPublic(user, roleInfo), token });
}

async function requestPasswordReset(req, res) {
  const { email } = req.body;
  if (!email) return fail(res, "El correo es obligatorio.");

  const user = await UserModel.findByEmail(email);
  if (!user) {
    return ok(res, { message: "Si el correo existe, se generó un enlace de recuperación." });
  }

  const resetToken = crypto.randomBytes(24).toString("hex");
  passwordResetTokens.set(resetToken, { userId: user.id, expiresAt: Date.now() + 30 * 60 * 1000 });

  return ok(res, {
    message: "Si el correo existe, se generó un enlace de recuperación.",
    devResetToken: resetToken, // SOLO para pruebas locales del proyecto universitario
  });
}

async function resetPassword(req, res) {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return fail(res, "Token y nueva contraseña son obligatorios.");
  if (newPassword.length < 6) return fail(res, "La nueva contraseña debe tener al menos 6 caracteres.");

  const entry = passwordResetTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    return fail(res, "El token de recuperación es inválido o expiró.", 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await UserModel.updatePassword(entry.userId, passwordHash);
  passwordResetTokens.delete(token);
  return ok(res, { message: "Contraseña actualizada correctamente." });
}

async function me(req, res) {
  const user = await UserModel.findById(req.user.id);
  if (!user) return fail(res, "Usuario no encontrado.", 404);
  const roleInfo = await UserModel.getPrimaryRole(user.id);
  return ok(res, { user: UserModel.toPublic(user, roleInfo) });
}

module.exports = { register, login, requestPasswordReset, resetPassword, me };
