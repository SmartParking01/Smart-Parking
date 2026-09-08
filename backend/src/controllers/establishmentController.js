const EstablishmentModel = require("../models/establishmentModel");
const CompanyModel = require("../models/companyModel");
const SpaceModel = require("../models/spaceModel");
const { ok, fail } = require("../utils/response");

async function create(req, res) {
  const { companyId, name, address, description } = req.body;
  if (!companyId || !name) return fail(res, "companyId y name son obligatorios.");
  if (!(await CompanyModel.findById(companyId))) return fail(res, "La empresa indicada no existe.", 404);

  try {
    const establishment = await EstablishmentModel.create({ companyId, name, address, description });
    return ok(res, { establishment }, 201);
  } catch (err) {
    if (err.code === "23505") return fail(res, "Esa empresa ya tiene un establecimiento con ese nombre.", 409);
    throw err;
  }
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
  const { name, address, description } = req.body;
  const establishment = await EstablishmentModel.update(req.params.id, { name, address, description });
  return ok(res, { establishment });
}



async function renderParkingMap() {
  const estId = currentEstablishmentId();
  const { parkings } = await Api.get(`/establishments/${estId}/map`);
  const isAdmin = state.user.role === "ADMIN";

  let html = `<div class="card">
    <div style="display:flex; gap:16px; font-size:12px; color:var(--muted); margin-bottom:10px;">
      <span><span class="badge AVAILABLE">&nbsp;</span> Disponible</span>
      <span><span class="badge RESERVED">&nbsp;</span> Reservado</span>
      <span><span class="badge OCCUPIED">&nbsp;</span> Ocupado</span>
      <span><span class="badge BLOCKED">&nbsp;</span> Bloqueado</span>
    </div>`;

  const parkingNames = Object.keys(parkings);
  if (parkingNames.length === 0) {
    html += `<p class="muted">Este establecimiento todavía no tiene espacios registrados.</p>`;
  }

  for (const parkingName of parkingNames) {
    html += `<h3 style="margin-bottom:4px;">${escapeHtml(parkingName)}</h3>`;
    const rows = parkings[parkingName];
    for (const [rowLabel, spaces] of Object.entries(rows)) {
      html += `<div class="row-label">${escapeHtml(rowLabel)}</div><div class="space-grid">`;
      for (const s of spaces) {
        html += `<div class="space-cell ${s.status}" title="${escapeHtml(s.code)} - ${s.status}"
          ${isAdmin ? `data-id="${s.id}" data-status="${s.status}" style="cursor:pointer;"` : ""}>${escapeHtml(s.code)}</div>`;
      }
      html += `</div>`;
    }
  }
  html += `</div>`;
  if (isAdmin) html += `<p class="muted">Como administrador, haz clic en un espacio disponible o bloqueado para alternar su bloqueo.</p><p class="error-text" id="map-error"></p>`;

  viewEl.innerHTML = html;

  if (isAdmin) {
    viewEl.querySelectorAll(".space-cell[data-id]").forEach((cell) => {
      cell.onclick = async () => {
        const status = cell.dataset.status;
        if (status !== "AVAILABLE" && status !== "BLOCKED") return;
        try {
          await Api.patch(`/spaces/${cell.dataset.id}/blocked`, { blocked: status !== "BLOCKED" });
          renderParkingMap();
        } catch (err) {
          document.getElementById("map-error").textContent = err.message;
        }
      };
    });
  }
}