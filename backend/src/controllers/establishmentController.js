const EstablishmentModel = require("../models/establishmentModel");
const SpaceModel = require("../models/spaceModel");
const { ok, fail } = require("../utils/response");

async function create(req, res) {
  const { name, type, address, rules } = req.body;
  if (!name) return fail(res, "El nombre del establecimiento es obligatorio.");

  const establishment = await EstablishmentModel.create({
    name,
    type: type || "OTHER",
    address,
    rules,
    createdBy: req.user.id,
  });
  return ok(res, { establishment }, 201);
}

async function list(req, res) {
  const establishments = await EstablishmentModel.listAll();
  const withAvailability = await Promise.all(
    establishments.map(async (e) => ({
      ...e,
      availability: await EstablishmentModel.availabilitySummary(e.id),
    }))
  );
  return ok(res, { establishments: withAvailability });
}

async function getOne(req, res) {
  const establishment = await EstablishmentModel.findById(req.params.id);
  if (!establishment) return fail(res, "Establecimiento no encontrado.", 404);
  return ok(res, {
    establishment,
    availability: await EstablishmentModel.availabilitySummary(establishment.id),
  });
}

async function update(req, res) {
  const existing = await EstablishmentModel.findById(req.params.id);
  if (!existing) return fail(res, "Establecimiento no encontrado.", 404);

  const { name, type, address, rules } = req.body;
  const establishment = await EstablishmentModel.update(req.params.id, { name, type, address, rules });
  return ok(res, { establishment });
}

// Mapa del parqueo: espacios agrupados por fila con su estado actual
async function map(req, res) {
  const establishment = await EstablishmentModel.findById(req.params.id);
  if (!establishment) return fail(res, "Establecimiento no encontrado.", 404);

  const spaces = await SpaceModel.listByEstablishment(req.params.id);
  const rows = {};
  for (const space of spaces) {
    const rowKey = space.row_label || "General";
    if (!rows[rowKey]) rows[rowKey] = [];
    rows[rowKey].push({ id: space.id, code: space.code, status: space.status });
  }
  return ok(res, { establishment: { id: establishment.id, name: establishment.name }, rows });
}

module.exports = { create, list, getOne, update, map };
