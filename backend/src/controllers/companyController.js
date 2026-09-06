const CompanyModel = require("../models/companyModel");
const { ok, fail } = require("../utils/response");

async function create(req, res) {
  const { name, taxId, email, phone, address } = req.body;
  if (!name || !taxId) return fail(res, "name y taxId son obligatorios.");
  try {
    const company = await CompanyModel.create({ name, taxId, email, phone, address });
    return ok(res, { company }, 201);
  } catch (err) {
    if (err.code === "23505") return fail(res, "Ya existe una empresa con ese taxId.", 409);
    throw err;
  }
}

async function list(req, res) {
  const companies = await CompanyModel.listAll();
  return ok(res, { companies });
}

module.exports = { create, list };
