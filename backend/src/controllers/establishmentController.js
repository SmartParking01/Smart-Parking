const EstablishmentModel = require("../models/establishmentModel");
const CompanyModel = require("../models/companyModel");
const SpaceModel = require("../models/spaceModel");
const { ok, fail } = require("../utils/response");

async function create(req, res) {
  const { companyId, name, address, description, latitude, longitude } = req.body;
  if (!companyId || !name) return fail(res, "companyId y name son obligatorios.");
  if (latitude !== undefined && (latitude < -90 || latitude > 90)) return fail(res, "Latitud inválida.");
  if (longitude !== undefined && (longitude < -180 || longitude > 180)) return fail(res, "Longitud inválida.");
  if (!(await CompanyModel.findById(companyId))) return fail(res, "La empresa indicada no existe.", 404);

  try {
    const establishment = await EstablishmentModel.create({ companyId, name, address, description, latitude, longitude });
    return ok(res, { establishment }, 201);
  } catch (err) {
    if (err.code === "23505") return fail(res, "Esa empresa ya tiene un establecimiento con ese nombre.", 409);
    throw err;
  }
}

// Listado público (sin autenticación) con solo lo necesario para un selector,
// usado en la pantalla de auto-registro de personal (antes de tener sesión).
// A propósito NO incluye disponibilidad ni datos sensibles.
async function listPublic(req, res) {
  const establishments = await EstablishmentModel.listAll();
  const minimal = establishments.map((e) => ({ id: e.id, name: e.name, address: e.address, company_name: e.company_name }));
  return ok(res, { establishments: minimal });
}

async function list(req, res) {
  const establishments = await EstablishmentModel.listAll();
  const withAvailability = await Promise.all(
    establishments.map(async (e) => ({ ...e, availability: await EstablishmentModel.availabilitySummary(e.id) }))
  );
  return ok(res, { establishments: withAvailability });
}

async function getOne(req, res) {
  const establishment = await EstablishmentModel.findById(req.params.id);
  if (!establishment) return fail(res, "Establecimiento no encontrado.", 404);
  return ok(res, { establishment, availability: await EstablishmentModel.availabilitySummary(establishment.id) });
}

async function update(req, res) {
  if (!(await EstablishmentModel.findById(req.params.id))) return fail(res, "Establecimiento no encontrado.", 404);
  const { name, address, description, latitude, longitude } = req.body;
  const establishment = await EstablishmentModel.update(req.params.id, { name, address, description, latitude, longitude });
  return ok(res, { establishment });
}

// Mapa de espacios de TODOS los parqueos del establecimiento, agrupados por parqueo/fila.
async function map(req, res) {
  const establishment = await EstablishmentModel.findById(req.params.id);
  if (!establishment) return fail(res, "Establecimiento no encontrado.", 404);

  const spaces = await SpaceModel.listByEstablishment(req.params.id);
  const parkings = {};
  for (const space of spaces) {
    if (!parkings[space.parking_name]) parkings[space.parking_name] = {};
    const rowKey = space.row_location || "General";
    if (!parkings[space.parking_name][rowKey]) parkings[space.parking_name][rowKey] = [];
    parkings[space.parking_name][rowKey].push({ id: space.id, code: space.code, status: space.status, type: space.type });
  }
  return ok(res, { establishment: { id: establishment.id, name: establishment.name }, parkings });
}

module.exports = { create, list, listPublic, getOne, update, map };
