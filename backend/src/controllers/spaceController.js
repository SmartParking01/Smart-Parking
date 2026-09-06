const SpaceModel = require("../models/spaceModel");
const ParkingModel = require("../models/parkingModel");
const { ok, fail } = require("../utils/response");

async function create(req, res) {
  const { parkingId, code, type, rowLocation } = req.body;
  if (!parkingId || !code) return fail(res, "parkingId y code son obligatorios.");
  if (!(await ParkingModel.findById(parkingId))) return fail(res, "El parqueo indicado no existe.", 404);

  try {
    const space = await SpaceModel.create({ parkingId, code, type, rowLocation });
    return ok(res, { space }, 201);
  } catch (err) {
    if (err.code === "23505") return fail(res, "Ya existe un espacio con ese código en este parqueo.", 409);
    // El código debe cumplir el formato letra(s)+número validado por la base de datos (chk_space_code_format)
    if (err.code === "23514") return fail(res, "El código de espacio debe tener el formato letra(s)+número, ej: A01.", 400);
    throw err;
  }
}

async function listByParking(req, res) {
  const spaces = await SpaceModel.listByParking(req.params.parkingId);
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

module.exports = { create, listByParking, setBlocked, remove };
