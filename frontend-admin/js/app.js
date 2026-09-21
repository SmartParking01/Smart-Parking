// =============================================================================
// Smart Parking · Admin Panel (Dark Premium)
// =============================================================================

const viewEl    = document.getElementById("view");
const pageTitle = document.getElementById("page-title");
const pageSub   = document.getElementById("page-sub");
const sideNav   = document.getElementById("side-nav");

let state = { user: null, parkings: [], currentParkingId: null };

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}
function fullName(obj, prefix = "") {
  const first = obj[`${prefix}first_name`];
  const last  = obj[`${prefix}last_name`];
  const name = `${first || ""} ${last || ""}`.trim();
  return name || null;
}
const ROLE_LABEL = { ADMIN: "Administración", ATTENDANT: "Guarda de seguridad" };
function roleLabel(role) { return ROLE_LABEL[role] || role; }

function estId() { return state.user.establishmentId; }

async function loadParkings(force = false) {
  if (state.parkings.length > 0 && !force) return state.parkings;
  const { parkings } = await Api.get(`/parkings/establishment/${estId()}`);
  state.parkings = parkings;
  if (!state.currentParkingId && parkings.length > 0) state.currentParkingId = parkings[0].id;
  return parkings;
}

async function getAllSpacesFlat() {
  const { parkings } = await Api.get(`/establishments/${estId()}/map`);
  const flat = [];
  for (const [parkingName, rows] of Object.entries(parkings)) {
    for (const [rowLabel, spaces] of Object.entries(rows)) {
      for (const s of spaces) flat.push({ ...s, parking_name: parkingName, row_location: rowLabel });
    }
  }
  return flat;
}

function setPageMeta(title, sub) {
  pageTitle.textContent = title;
  if (pageSub) pageSub.textContent = sub || "";
}

// ---------------------------------------------------------------------------
// ROUTER
// ---------------------------------------------------------------------------
const routes = {
  "#/dashboard":      renderDashboard,
  "#/entries":        renderEntries,
  "#/exits":          renderExits,
  "#/parking":        renderParkingMap,
  "#/reservations":   renderReservations,
  "#/spaces":         renderSpaces,
  "#/establishments": renderEstablishments,
  "#/staff":          renderStaff,
  "#/stats":          renderStats,
};

const PAGE_META = {
  "#/dashboard":      ["Panel general", "Aquí tienes un resumen del estado de tu parqueo hoy."],
  "#/entries":        ["Entradas", "Valida reservas por QR o registra entradas sin reserva."],
  "#/exits":          ["Salidas", "Registra la salida de vehículos y libera espacios."],
  "#/parking":        ["Mapa del parqueo", "Vista en tiempo real de todos los espacios."],
  "#/reservations":   ["Reservas", "Consulta las reservas de tu establecimiento."],
  "#/spaces":         ["Gestión de espacios", "Crea, bloquea o elimina espacios."],
  "#/establishments": ["Establecimientos", "Administra tus establecimientos y parqueos."],
  "#/staff":          ["Personal", "Registra y consulta cuentas de personal."],
  "#/stats":          ["Estadísticas", "Ocupación y predicción por hora."],
};

function navigate(route) { window.location.hash = route; }

async function router() {
  if (!Api.getToken()) { window.location.href = "../frontend/index.html"; return; }

  if (!state.user) {
    try {
      const { user } = await Api.get("/auth/me");
      state.user = user;
      const full = fullName(user) || user.email;
      document.getElementById("user-name").textContent = full;
      document.getElementById("user-role").textContent = roleLabel(user.role);
      document.getElementById("user-initial").textContent = (full[0] || "A").toUpperCase();
      document.getElementById("chip-name").textContent = full;
      document.getElementById("chip-initial").textContent = (full[0] || "A").toUpperCase();
    } catch (e) {
      Api.clearToken();
      window.location.href = "../frontend/index.html";
      return;
    }
  }

  sideNav.querySelectorAll(".admin-only").forEach((btn) =>
    btn.classList.toggle("hidden", state.user.role !== "ADMIN")
  );

  const route = window.location.hash || "#/dashboard";
  sideNav.querySelectorAll(".side-btn").forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.route === route)
  );

  const [title, sub] = PAGE_META[route] || ["Panel", ""];
  setPageMeta(title, sub);

  const handler = routes[route] || renderDashboard;
  try { await handler(); }
  catch (err) {
    viewEl.innerHTML = `<div class="card"><p class="error-text">${escapeHtml(err.message)}</p></div>`;
  }
}

window.addEventListener("hashchange", router);
sideNav.addEventListener("click", (e) => {
  const btn = e.target.closest(".side-btn");
  if (btn && btn.dataset.route) navigate(btn.dataset.route);
});
document.getElementById("logout-btn").onclick = () => {
  Api.clearToken();
  window.location.href = "../frontend/index.html";
};

// ---------------------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------------------
async function renderDashboard() {
  const id = estId();
  if (!id) {
    viewEl.innerHTML = `<div class="card"><p class="error-text">Tu cuenta no tiene un establecimiento asignado.</p></div>`;
    return;
  }

  const { current, occupancyRatePercent } = await Api.get(`/stats/${id}/summary`);
  const { entries } = await Api.get("/entries/open");

  const pctOccupied  = current.TOTAL > 0 ? Math.round(current.OCCUPIED  / current.TOTAL * 100) : 0;
  const pctAvailable = current.TOTAL > 0 ? Math.round(current.AVAILABLE / current.TOTAL * 100) : 0;

  viewEl.innerHTML = `
    <div class="grid-4" style="margin-bottom:18px">
      <div class="stat">
        <div class="stat-head">
          <div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="15" rx="2"/><path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2"/></svg></div>
        </div>
        <div><div class="stat-label">Total de espacios</div><div class="stat-value">${current.TOTAL}</div></div>
      </div>
      <div class="stat">
        <div class="stat-head">
          <div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17h14M5 17V9l2-5h10l2 5v8M7 17v2a1 1 0 001 1h1a1 1 0 001-1v-2M14 17v2a1 1 0 001 1h1a1 1 0 001-1v-2"/></svg></div>
          <span class="stat-pct">${pctOccupied}%</span>
        </div>
        <div><div class="stat-label">Espacios ocupados</div><div class="stat-value">${current.OCCUPIED}</div></div>
      </div>
      <div class="stat">
        <div class="stat-head">
          <div class="stat-icon yellow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17h14M5 17V9l2-5h10l2 5v8M7 17v2a1 1 0 001 1h1a1 1 0 001-1v-2M14 17v2a1 1 0 001 1h1a1 1 0 001-1v-2"/></svg></div>
          <span class="stat-pct">${pctAvailable}%</span>
        </div>
        <div><div class="stat-label">Espacios disponibles</div><div class="stat-value">${current.AVAILABLE}</div></div>
      </div>
      <div class="stat">
        <div class="stat-head">
          <div class="stat-icon sky"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></div>
        </div>
        <div><div class="stat-label">Vehículos dentro</div><div class="stat-value">${entries.length}</div></div>
      </div>
    </div>

    <div class="card">
      <h3>Ocupación actual</h3>
      <div class="stat-value" style="color:var(--green-bright)">${occupancyRatePercent}%</div>
      <p class="muted" style="margin-top:6px">${current.TOTAL} espacios en total · ${current.RESERVED} reservados · ${current.BLOCKED} bloqueados</p>
    </div>

    <div class="card">
      <h3>Vehículos actualmente dentro (${entries.length})</h3>
      ${entries.length === 0
        ? '<p class="muted">No hay vehículos dentro en este momento.</p>'
        : `<table>
            <thead><tr><th>Espacio</th><th>Parqueo</th><th>Conductor</th><th>Entrada</th><th>Origen</th></tr></thead>
            <tbody>
              ${entries.map(e => `<tr>
                <td><strong>${escapeHtml(e.space_code)}</strong></td>
                <td>${escapeHtml(e.parking_name)}</td>
                <td>${escapeHtml(fullName(e, "user_") || "Sin registrar")}</td>
                <td>${new Date(e.entry_time).toLocaleString()}</td>
                <td>${e.entry_method === "RESERVATION" ? "Reserva" : "Sin reserva"}</td>
              </tr>`).join("")}
            </tbody>
          </table>`}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// ENTRADAS
// ---------------------------------------------------------------------------
async function renderEntries() {
  const available = (await getAllSpacesFlat()).filter(s => s.status === "AVAILABLE");

  viewEl.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <h3>Validar reserva por QR</h3>
        <p class="muted">Pega el contenido leído del código QR del conductor.</p>
        <div class="input-group">
          <label>Contenido del QR</label>
          <textarea id="qr-input" rows="3" placeholder="Contenido escaneado..."></textarea>
        </div>
        <p class="error-text" id="qr-error"></p>
        <p class="success-text" id="qr-success"></p>
        <button class="btn" id="qr-submit">Validar e ingresar</button>
      </div>

      <div class="card">
        <h3>Registrar entrada sin reserva</h3>
        <p class="muted">Asigna manualmente un espacio disponible a un conductor.</p>
        <div class="input-group">
          <label>Espacio disponible</label>
          <select id="walkin-space">
            ${available.length === 0
              ? '<option value="">No hay espacios disponibles</option>'
              : available.map(s => `<option value="${s.id}">${escapeHtml(s.parking_name)} · ${escapeHtml(s.code)} (${escapeHtml(s.row_location || "")})</option>`).join("")}
          </select>
        </div>
        <p class="error-text" id="walkin-error"></p>
        <p class="success-text" id="walkin-success"></p>
        <button class="btn" id="walkin-submit" ${available.length === 0 ? "disabled" : ""}>Registrar entrada</button>
      </div>
    </div>
  `;

  document.getElementById("qr-submit").onclick = async () => {
    const errEl = document.getElementById("qr-error");
    const okEl  = document.getElementById("qr-success");
    errEl.textContent = ""; okEl.textContent = "";
    try {
      const data = await Api.post("/entries/scan-qr", { signedPayload: document.getElementById("qr-input").value.trim() });
      okEl.textContent = `Ingreso autorizado: espacio ${data.space.code} para ${data.user ? (fullName(data.user) || data.user.email) : "conductor"}.`;
      document.getElementById("qr-input").value = "";
    } catch (err) { errEl.textContent = err.message; }
  };

  document.getElementById("walkin-submit").onclick = async () => {
    const errEl = document.getElementById("walkin-error");
    const okEl  = document.getElementById("walkin-success");
    errEl.textContent = ""; okEl.textContent = "";
    try {
      const spaceId = document.getElementById("walkin-space").value;
      const data = await Api.post("/entries/walk-in", { spaceId });
      okEl.textContent = `Entrada registrada en el espacio ${data.space.code}.`;
      renderEntries();
    } catch (err) { errEl.textContent = err.message; }
  };
}

// ---------------------------------------------------------------------------
// SALIDAS
// ---------------------------------------------------------------------------
async function renderExits() {
  const { entries } = await Api.get("/entries/open");

  viewEl.innerHTML = `
    <div class="card">
      <h3>Vehículos dentro del parqueo</h3>
      ${entries.length === 0
        ? '<p class="muted">No hay vehículos dentro.</p>'
        : `<table>
            <thead><tr><th>Espacio</th><th>Parqueo</th><th>Conductor</th><th>Hora de entrada</th><th></th></tr></thead>
            <tbody>
              ${entries.map(e => `<tr>
                <td><strong>${escapeHtml(e.space_code)}</strong></td>
                <td>${escapeHtml(e.parking_name)}</td>
                <td>${escapeHtml(fullName(e, "user_") || "Sin registrar")}</td>
                <td>${new Date(e.entry_time).toLocaleString()}</td>
                <td><button class="btn yellow exit-btn" data-space="${e.space_id}">Registrar salida</button></td>
              </tr>`).join("")}
            </tbody>
          </table>`}
      <p class="error-text" id="exit-error"></p>
    </div>
  `;

  viewEl.querySelectorAll(".exit-btn").forEach(btn => {
    btn.onclick = async () => {
      try {
        await Api.post("/entries/exit", { spaceId: btn.dataset.space });
        renderExits();
      } catch (err) {
        document.getElementById("exit-error").textContent = err.message;
      }
    };
  });
}

// ---------------------------------------------------------------------------
// MAPA DEL PARQUEO
// ---------------------------------------------------------------------------
async function renderParkingMap() {
  const { parkings, establishment } = await Api.get(`/establishments/${estId()}/map`);
  const isAdmin = state.user.role === "ADMIN";

  let html = `<div class="card">
    <h3>${escapeHtml(establishment.name)}</h3>
    <div class="legend-row">
      <span><span class="dot AVAILABLE"></span>Disponible</span>
      <span><span class="dot RESERVED"></span>Reservado</span>
      <span><span class="dot OCCUPIED"></span>Ocupado</span>
      <span><span class="dot BLOCKED"></span>Bloqueado</span>
    </div>`;

  const parkingNames = Object.keys(parkings);
  if (parkingNames.length === 0) {
    html += `<p class="muted">Este establecimiento todavía no tiene parqueos/espacios configurados.</p>`;
  }

  for (const parkingName of parkingNames) {
    html += `<div class="parking-title">${escapeHtml(parkingName)}</div>`;
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
    viewEl.querySelectorAll(".space-cell[data-id]").forEach(cell => {
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

// ---------------------------------------------------------------------------
// RESERVAS
// ---------------------------------------------------------------------------
async function renderReservations() {
  const id = estId();
  viewEl.innerHTML = `
    <div class="card">
      <div class="input-group" style="max-width:240px;">
        <label>Filtrar por estado</label>
        <select id="status-filter">
          <option value="">Todas</option>
          <option value="PENDING">Pendientes</option>
          <option value="CONFIRMED">Confirmadas</option>
          <option value="ACTIVE">Activas (dentro)</option>
          <option value="COMPLETED">Completadas</option>
          <option value="CANCELLED">Canceladas</option>
          <option value="EXPIRED">Expiradas</option>
        </select>
      </div>
      <div id="res-table"></div>
    </div>
  `;

  async function load() {
    const status = document.getElementById("status-filter").value;
    const { reservations } = await Api.get(`/reservations/establishment/${id}${status ? `?status=${status}` : ""}`);
    document.getElementById("res-table").innerHTML = reservations.length === 0
      ? '<p class="muted">No hay reservas para este filtro.</p>'
      : `<table>
          <thead><tr><th>Conductor</th><th>Parqueo</th><th>Espacio</th><th>Creada</th><th>Vence</th><th>Estado</th></tr></thead>
          <tbody>
            ${reservations.map(r => `<tr>
              <td>${escapeHtml(fullName(r, "user_") || r.user_email)}</td>
              <td>${escapeHtml(r.parking_name)}</td>
              <td><strong>${escapeHtml(r.space_code)}</strong></td>
              <td>${new Date(r.created_at).toLocaleString()}</td>
              <td>${new Date(r.end_time).toLocaleString()}</td>
              <td><span class="badge ${r.status}">${r.status}</span></td>
            </tr>`).join("")}
          </tbody>
        </table>`;
  }
  document.getElementById("status-filter").onchange = load;
  load();
}

// ---------------------------------------------------------------------------
// GESTIÓN DE ESPACIOS
// ---------------------------------------------------------------------------
async function renderSpaces() {
  const parkings = await loadParkings();
  if (parkings.length === 0) {
    viewEl.innerHTML = `<div class="card"><p class="muted">Este establecimiento todavía no tiene ningún parqueo creado.</p>
      <button class="btn" id="go-parkings" style="margin-top:14px">Crear un parqueo primero</button></div>`;
    document.getElementById("go-parkings").onclick = () => navigate("#/establishments");
    return;
  }
  if (!state.currentParkingId) state.currentParkingId = parkings[0].id;

  const { spaces } = await Api.get(`/spaces/parking/${state.currentParkingId}`);

  viewEl.innerHTML = `
    <div class="card">
      <div class="input-group" style="max-width:300px;">
        <label>Parqueo</label>
        <select id="parking-select">
          ${parkings.map(p => `<option value="${p.id}" ${p.id === state.currentParkingId ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}
        </select>
      </div>
    </div>

    <div class="card">
      <h3>Crear espacio</h3>
      <div class="grid-2">
        <div class="input-group"><label>Código (ej: A01)</label><input id="sp-code" /></div>
        <div class="input-group"><label>Fila / ubicación</label><input id="sp-row" placeholder="Fila A" /></div>
      </div>
      <p class="error-text" id="sp-error"></p>
      <button class="btn" id="sp-submit">Agregar espacio</button>
    </div>

    <div class="card">
      <h3>Espacios existentes (${spaces.length})</h3>
      <table>
        <thead><tr><th>Código</th><th>Fila</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          ${spaces.map(s => `<tr>
            <td><strong>${escapeHtml(s.code)}</strong></td>
            <td>${escapeHtml(s.row_location || "-")}</td>
            <td><span class="badge ${s.status}">${s.status}</span></td>
            <td style="display:flex;gap:8px">
              <button class="btn secondary block-btn" data-id="${s.id}" data-status="${s.status}">${s.status === "BLOCKED" ? "Desbloquear" : "Bloquear"}</button>
              <button class="btn danger del-btn" data-id="${s.id}">Eliminar</button>
            </td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById("parking-select").onchange = (e) => {
    state.currentParkingId = e.target.value;
    renderSpaces();
  };

  document.getElementById("sp-submit").onclick = async () => {
    const errEl = document.getElementById("sp-error");
    errEl.textContent = "";
    try {
      await Api.post("/spaces", {
        parkingId: state.currentParkingId,
        code: document.getElementById("sp-code").value.trim().toUpperCase(),
        rowLocation: document.getElementById("sp-row").value.trim(),
      });
      renderSpaces();
    } catch (err) { errEl.textContent = err.message; }
  };

  viewEl.querySelectorAll(".block-btn").forEach(btn => {
    btn.onclick = async () => {
      await Api.patch(`/spaces/${btn.dataset.id}/blocked`, { blocked: btn.dataset.status !== "BLOCKED" });
      renderSpaces();
    };
  });
  viewEl.querySelectorAll(".del-btn").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("¿Eliminar este espacio?")) return;
      try {
        await Api.delete(`/spaces/${btn.dataset.id}`);
        renderSpaces();
      } catch (err) { alert(err.message); }
    };
  });
}

// ---------------------------------------------------------------------------
// ESTABLECIMIENTOS Y PARQUEOS
// ---------------------------------------------------------------------------
let locationPickerMap = null;
let locationPickerMarker = null;

function initLocationPicker(defaultLat, defaultLng) {
  const mapEl = document.getElementById("location-picker-map");
  if (!mapEl) return;
  const lat = defaultLat ?? 9.9281;
  const lng = defaultLng ?? -84.0907;

  locationPickerMap = L.map(mapEl).setView([lat, lng], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap" }).addTo(locationPickerMap);
  locationPickerMarker = L.marker([lat, lng], { draggable: true }).addTo(locationPickerMap);

  function updateInputs(latlng) {
    document.getElementById("e-lat").value = latlng.lat.toFixed(6);
    document.getElementById("e-lng").value = latlng.lng.toFixed(6);
  }
  updateInputs(locationPickerMarker.getLatLng());
  locationPickerMarker.on("dragend", () => updateInputs(locationPickerMarker.getLatLng()));
  locationPickerMap.on("click", (e) => {
    locationPickerMarker.setLatLng(e.latlng);
    updateInputs(e.latlng);
  });
}

async function renderEstablishments() {
  const { establishments } = await Api.get("/establishments");
  const parkings = state.user.establishmentId ? await loadParkings(true) : [];

  viewEl.innerHTML = `
    <div class="card">
      <h3>Crear establecimiento</h3>
      <p class="muted">Haz clic en el mapa (o arrastra el pin) para ubicar el establecimiento.</p>
      <div id="location-picker-map"></div>
      <div class="grid-2">
        <div class="input-group"><label>Nombre</label><input id="e-name" /></div>
        <div class="input-group"><label>Dirección</label><input id="e-address" /></div>
      </div>
      <div class="grid-2">
        <div class="input-group"><label>Latitud</label><input id="e-lat" readonly /></div>
        <div class="input-group"><label>Longitud</label><input id="e-lng" readonly /></div>
      </div>
      <div class="input-group"><label>Descripción</label><textarea id="e-description" rows="2"></textarea></div>
      <p class="error-text" id="e-error"></p>
      <button class="btn" id="e-submit">Crear establecimiento</button>
    </div>

    <div class="card">
      <h3>Establecimientos existentes</h3>
      <table>
        <thead><tr><th>Nombre</th><th>Empresa</th><th>Espacios</th><th>Ubicación</th></tr></thead>
        <tbody>
          ${establishments.map(e => `<tr>
            <td><strong>${escapeHtml(e.name)}</strong></td>
            <td>${escapeHtml(e.company_name)}</td>
            <td>${e.availability.TOTAL}</td>
            <td>${e.latitude != null ? "Ubicado" : '<span class="muted">Sin coordenadas</span>'}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h3>Crear parqueo (dentro de tu establecimiento)</h3>
      <div class="grid-2">
        <div class="input-group"><label>Nombre del parqueo</label><input id="pk-name" placeholder="Parqueo Principal" /></div>
        <div class="input-group"><label>Capacidad</label><input id="pk-capacity" type="number" min="1" /></div>
      </div>
      <p class="error-text" id="pk-error"></p>
      <button class="btn" id="pk-submit">Crear parqueo</button>
      <table style="margin-top:14px;">
        <thead><tr><th>Parqueo</th><th>Capacidad declarada</th></tr></thead>
        <tbody>
          ${parkings.map(p => `<tr><td>${escapeHtml(p.name)}</td><td>${p.capacity}</td></tr>`).join("") || '<tr><td colspan="2" class="muted">Sin parqueos todavía</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  initLocationPicker();

  document.getElementById("e-submit").onclick = async () => {
    const errEl = document.getElementById("e-error");
    errEl.textContent = "";
    try {
      await Api.post("/establishments", {
        companyId: state.user.companyId,
        name: document.getElementById("e-name").value.trim(),
        address: document.getElementById("e-address").value.trim(),
        description: document.getElementById("e-description").value.trim(),
        latitude: Number(document.getElementById("e-lat").value),
        longitude: Number(document.getElementById("e-lng").value),
      });
      renderEstablishments();
    } catch (err) { errEl.textContent = err.message; }
  };

  document.getElementById("pk-submit").onclick = async () => {
    const errEl = document.getElementById("pk-error");
    errEl.textContent = "";
    try {
      await Api.post("/parkings", {
        establishmentId: estId(),
        name: document.getElementById("pk-name").value.trim(),
        capacity: Number(document.getElementById("pk-capacity").value),
      });
      state.parkings = [];
      renderEstablishments();
    } catch (err) { errEl.textContent = err.message; }
  };
}

// ---------------------------------------------------------------------------
// PERSONAL
// ---------------------------------------------------------------------------
async function renderStaff() {
  const id = estId();
  const { users } = await Api.get(`/users/staff/${id}`);

  viewEl.innerHTML = `
    <div class="card">
      <h3>Registrar personal</h3>
      <div class="grid-2">
        <div class="input-group"><label>Nombre</label><input id="st-name" /></div>
        <div class="input-group"><label>Correo</label><input id="st-email" type="email" /></div>
        <div class="input-group"><label>Teléfono</label><input id="st-phone" /></div>
        <div class="input-group">
          <label>Rol</label>
          <select id="st-role"><option value="ATTENDANT">Guarda de seguridad</option><option value="ADMIN">Administrador</option></select>
        </div>
      </div>
      <div class="input-group"><label>Contraseña temporal</label><input id="st-password" type="password" /></div>
      <p class="error-text" id="st-error"></p>
      <button class="btn" id="st-submit">Crear cuenta</button>
    </div>

    <div class="card">
      <h3>Personal registrado</h3>
      <table>
        <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th></tr></thead>
        <tbody>
          ${users.map(u => `<tr>
            <td>${escapeHtml(fullName(u))}</td>
            <td>${escapeHtml(u.email)}</td>
            <td><span class="badge role-pill">${u.role_name}</span></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById("st-submit").onclick = async () => {
    const errEl = document.getElementById("st-error");
    errEl.textContent = "";
    try {
      await Api.post("/users/staff", {
        name: document.getElementById("st-name").value.trim(),
        email: document.getElementById("st-email").value.trim(),
        phone: document.getElementById("st-phone").value.trim(),
        password: document.getElementById("st-password").value,
        role: document.getElementById("st-role").value,
        establishmentId: id,
      });
      renderStaff();
    } catch (err) { errEl.textContent = err.message; }
  };
}

// ---------------------------------------------------------------------------
// ESTADÍSTICAS
// ---------------------------------------------------------------------------
async function renderStats() {
  const id = estId();
  const { current, occupancyRatePercent } = await Api.get(`/stats/${id}/summary`);
  const { prediction, weekdayHistory } = await Api.get(`/stats/${id}/prediction`);

  viewEl.innerHTML = `
    <div class="grid-3">
      <div class="stat">
        <div class="stat-head">
          <div class="stat-icon green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M7 17v-6M12 17V7M17 17v-4"/></svg>
          </div>
        </div>
        <div>
          <div class="stat-label">Ocupación actual</div>
          <div class="stat-value">${occupancyRatePercent}%</div>
        </div>
      </div>

      <div class="stat">
        <div class="stat-head">
          <div class="stat-icon blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="15" rx="2"/><path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2"/></svg>
          </div>
        </div>
        <div>
          <div class="stat-label">Espacios ocupados</div>
          <div class="stat-value">${current.OCCUPIED}</div>
        </div>
      </div>

      <div class="stat">
        <div class="stat-head">
          <div class="stat-icon yellow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="15" rx="2"/></svg>
          </div>
        </div>
        <div>
          <div class="stat-label">Total de espacios</div>
          <div class="stat-value">${current.TOTAL}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>Predicción de ocupación por hora</h3>
      ${!prediction.available ? `<p class="muted">${prediction.message}</p>` :
        `<table>
          <thead>
            <tr><th>Hora</th><th>Entradas históricas</th><th>Nivel estimado</th></tr>
          </thead>
          <tbody>
            ${prediction.hours.map(h => `<tr>
              <td>${h.label}</td>
              <td>${h.entriesHistorically}</td>
              <td><span class="badge ${h.level === 'ALTA' ? 'OCCUPIED' : h.level === 'MEDIA' ? 'RESERVED' : 'AVAILABLE'}">${h.level}</span></td>
            </tr>`).join("")}
          </tbody>
        </table>`}
    </div>

    <div class="card">
      <h3>Historial por día de la semana</h3>
      ${weekdayHistory.length === 0 ? '<p class="muted">Sin datos históricos todavía.</p>' :
        `<table>
          <thead>
            <tr><th>Día</th><th>Entradas registradas</th></tr>
          </thead>
          <tbody>
            ${weekdayHistory.map(w => `<tr><td>${w.name}</td><td>${w.entriesHistorically}</td></tr>`).join("")}
          </tbody>
        </table>`}
    </div>
  `;
}

// Arranca el router
router();