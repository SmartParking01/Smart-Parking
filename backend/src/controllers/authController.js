const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const UserModel = require("../models/userModel");
const { signSessionToken } = require("../utils/jwt");
const { ok, fail } = require("../utils/response");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function register(req, res) {
  const { name, email, phone, password } = req.body;

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

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await UserModel.create({ name, email, phone, passwordHash, role: "USER" });

  const token = signSessionToken({ id: user.id, role: user.role, email: user.email });
  return ok(res, { user: UserModel.toPublic(user), token }, 201);
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return fail(res, "Correo y contraseña son obligatorios.");
  }

  const user = await UserModel.findByEmail(email);
  if (!user) {
    return fail(res, "Credenciales inválidas.", 401);
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    return fail(res, "Credenciales inválidas.", 401);
  }

  const token = signSessionToken({
    id: user.id,
    role: user.role,
    email: user.email,
    establishmentId: user.establishment_id,
  });
  return ok(res, { user: UserModel.toPublic(user), token });
}

// Genera un token de recuperación. En un entorno real se enviaría por correo;
// aquí se devuelve en la respuesta para poder probar el flujo end-to-end.
async function requestPasswordReset(req, res) {
  const { email } = req.body;
  if (!email) return fail(res, "El correo es obligatorio.");

  const user = await UserModel.findByEmail(email);
  if (!user) {
    // No revelar si el correo existe o no, por seguridad.
    return ok(res, { message: "Si el correo existe, se generó un enlace de recuperación." });
  }

  const resetToken = crypto.randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await UserModel.setResetToken(user.id, resetToken, expires);

  return ok(res, {
    message: "Si el correo existe, se generó un enlace de recuperación.",
    devResetToken: resetToken, // SOLO para pruebas locales del proyecto universitario
  });
}

async function resetPassword(req, res) {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return fail(res, "Token y nueva contraseña son obligatorios.");
  if (newPassword.length < 6) return fail(res, "La nueva contraseña debe tener al menos 6 caracteres.");

  const user = await UserModel.findByResetToken(token);
  if (!user || new Date(user.reset_token_expires) < new Date()) {
    return fail(res, "El token de recuperación es inválido o expiró.", 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await UserModel.updatePassword(user.id, passwordHash);
  return ok(res, { message: "Contraseña actualizada correctamente." });
}

async function me(req, res) {
  const user = await UserModel.findById(req.user.id);
  if (!user) return fail(res, "Usuario no encontrado.", 404);
  return ok(res, { user: UserModel.toPublic(user) });
}

module.exports = { register, login, requestPasswordReset, resetPassword, me };
