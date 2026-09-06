const ParkingModel = require("../models/parkingModel");
const EstablishmentModel = require("../models/establishmentModel");
const { ok, fail } = require("../utils/response");

async function create(req, res) {
  const { establishmentId, name, capacity, openingTime, closingTime } = req.body;
  if (!establishmentId || !name || !capacity) {
    return fail(res, "establishmentId, name y capacity son obligatorios.");
  }
  if (!(await EstablishmentModel.findById(establishmentId))) {
    return fail(res, "El establecimiento indicado no existe.", 404);
  }
  try {
    const parking = await ParkingModel.create({ establishmentId, name, capacity, openingTime, closingTime });
    return ok(res, { parking }, 201);
  } catch (err) {
    if (err.code === "23505") return fail(res, "Ese establecimiento ya tiene un parqueo con ese nombre.", 409);
    if (err.code === "23514") return fail(res, "La capacidad debe ser un número positivo.", 400);
    throw err;
  }
}

async function listByEstablishment(req, res) {
  const parkings = await ParkingModel.listByEstablishment(req.params.establishmentId);
  return ok(res, { parkings });
}

module.exports = { create, listByEstablishment };
