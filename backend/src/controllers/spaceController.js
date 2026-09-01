const SpaceModel = require("../models/spaceModel");
const EstablishmentModel = require("../models/establishmentModel");
const { ok, fail } = require("../utils/response");

const CODE_REGEX = /^[A-Za-z]{1,3}\d{1,3}$/; // ej: A01, B12 (formalización simple del formato de espacio)

async function create(req, res) {
  const { establishmentId, code, rowLabel } = req.body;
  if (!establishmentId || !code) return fail(res, "establishmentId y code son obligatorios.");
  if (!CODE_REGEX.test(code)) {
    return fail(res, "El código de espacio debe tener el formato letra(s)+número, ej: A01.");
  }
  if (!(await EstablishmentModel.findById(establishmentId))) {
    return fail(res, "El establecimiento indicado no existe.", 404);
  }

  try {
    const space = await SpaceModel.create({ establishmentId, code, rowLabel });
    return ok(res, { space }, 201);
  } catch (err) {
    // Código de error de PostgreSQL para violación de restricción UNIQUE
    if (err.code === "23505") {
      return fail(res, "Ya existe un espacio con ese código en este establecimiento.", 409);
    }
    throw err;
  }
}

async function listByEstablishment(req, res) {
  const spaces = await SpaceModel.listByEstablishment(req.params.establishmentId);
  return ok(res, { spaces });
}

async function setBlocked(req, res) {
  const { blocked } = req.body;
  const space = await SpaceModel.findById(req.params.id);
  if (!space) return fail(res, "Espacio no encontrado.", 404);

  if (blocked && space.status === "OCCUPIED") {
    return fail(res, "No se puede bloquear un espacio actualmente ocupado.", 409);
  }
  const updated = await SpaceModel.setBlocked(req.params.id, blocked);
  return ok(res, { space: updated });
}

async function remove(req, res) {
  const space = await SpaceModel.findById(req.params.id);
  if (!space) return fail(res, "Espacio no encontrado.", 404);
  if (space.status !== "AVAILABLE" && space.status !== "BLOCKED") {
    return fail(res, "Solo se pueden eliminar espacios disponibles o bloqueados.", 409);
  }
  await SpaceModel.delete(req.params.id);
  return ok(res, { message: "Espacio eliminado." });
}

module.exports = { create, listByEstablishment, setBlocked, remove };
