const { verifySessionToken } = require("../utils/jwt");
const { fail } = require("../utils/response");

/**
 * Exige un JWT válido en el header Authorization: Bearer <token>.
 * Adjunta la info del usuario decodificada a req.user.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return fail(res, "Token de autenticación faltante o inválido.", 401);
  }

  try {
    const decoded = verifySessionToken(token);
    req.user = decoded; // { id, role, establishmentId, email }
    next();
  } catch (err) {
    return fail(res, "Token inválido o expirado.", 401);
  }
}

/**
 * Restringe el acceso a los roles indicados.
 * Uso: authorize("ADMIN"), authorize("ADMIN", "ATTENDANT")
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return fail(res, "No autenticado.", 401);
    }
    if (!allowedRoles.includes(req.user.role)) {
      return fail(res, "No tiene permisos para realizar esta acción.", 403);
    }
    next();
  };
}

module.exports = { authenticate, authorize };
