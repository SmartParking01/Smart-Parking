const viewEl = document.getElementById("view");
const pageTitle = document.getElementById("page-title");
const whoAmI = document.getElementById("who-am-i");
const sidebar = document.getElementById("sidebar");
const sideNav = document.getElementById("side-nav");

let state = { user: null, parkings: [], currentParkingId: null };

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function fullName(obj, prefix = "") {
  const first = obj[`${prefix}first_name`];
  const last = obj[`${prefix}last_name`];
  const name = `${first || ""} ${last || ""}`.trim();
  return name || null;
}

function estId() {
  return state.user.establishmentId;
}

// Trae (y cachea en memoria) los parqueos del establecimiento del usuario.
async function loadParkings(force = false) {
  if (state.parkings.length > 0 && !force) return state.parkings;
  const { parkings } = await Api.get(`/parkings/establishment/${estId()}`);
  state.parkings = parkings;
  if (!state.currentParkingId && parkings.length > 0) state.currentParkingId = parkings[0].id;
  return parkings;
}

// Todos los espacios de TODOS los parqueos del establecimiento, aplanados
// (útil para el walk-in y el mapa general).
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

// ---------------------------------------------------------------------------
// LOGIN (pantalla completa, sin sidebar)
// ---------------------------------------------------------------------------
function renderLoginScreen() {
  document.getElementById("shell").style.display = "none";
  let el = document.getElementById("login-screen");
  if (!el) {
    el = document.createElement("div");
    el.id = "login-screen";
    document.body.appendChild(el);
  }
  el.style.display = "flex";
  el.innerHTML = `
    <div class="login-card">
      <h1 style="margin-top:0;">Smart Parking</h1>
      <p class="muted">Panel administrativo — Personal y administradores</p>
      <div class="input-group"><label>Correo electrónico</label><input id="l-email" type="email" /></div>
      <div class="input-group"><label>Contraseña</label><input id="l-password" type="password" /></div>
      <p class="error-text" id="l-error"></p>
      <button class="btn" id="l-submit" style="width:100%;">Iniciar sesión</button>
      <button class="link-btn" id="go-staff-register" style="width:100%;margin-top:10px;">Crear cuenta de personal nueva</button>
    </div>
  `;
  document.getElementById("l-submit").onclick = async () => {
    const errEl = document.getElementById("l-error");
    errEl.textContent = "";
    try {
      const data = await Api.post("/auth/login", {
        email: document.getElementById("l-email").value.trim(),
        password: document.getElementById("l-password").value,
      });
      if (!["ADMIN", "ATTENDANT"].includes(data.user.role)) {
        errEl.textContent = "Esta cuenta no tiene acceso al panel administrativo.";
        return;
      }
      Api.setToken(data.token);
      state.user = data.user;
      state.parkings = [];
      state.currentParkingId = null;
      afterLogin();
    } catch (err) {
      errEl.textContent = err.message;
    }
  };
  document.getElementById("go-staff-register").onclick = () => renderStaffRegisterScreen();
}

// Alta de personal: el rol (ADMIN/ATTENDANT) se decide solo, en el backend,
// según el correo — aquí no se pide ni se muestra ningún selector de rol.
// El establecimiento SÍ hay que elegirlo: sin eso, la cuenta de personal no
// tendría a qué establecimiento pertenecer.
async function renderStaffRegisterScreen() {
  const el = document.getElementById("login-screen");
  el.innerHTML = `
    <div class="login-card">
      <h1 style="margin-top:0;">Crear cuenta de personal</h1>
      <p class="muted">Usa tu correo institucional (@smartparking-staff.cr). El sistema detecta solo si eres guarda o administrador — no hay que elegir el rol.</p>
      <div class="input-group"><label>Nombre completo</label><input id="sr-name" type="text" /></div>
      <div class="input-group"><label>Correo institucional</label><input id="sr-email" type="email" placeholder="nombre@smartparking-staff.cr" /></div>
      <div class="input-group"><label>Teléfono</label><input id="sr-phone" type="text" /></div>
      <div class="input-group">
        <label>Establecimiento al que perteneces</label>
        <select id="sr-establishment"><option value="">Cargando...</option></select>
      </div>
      <div class="input-group"><label>Contraseña</label><input id="sr-password" type="password" /></div>
      <p class="error-text" id="sr-error"></p>
      <button class="btn" id="sr-submit" style="width:100%;">Registrarme</button>
      <button class="link-btn" id="sr-back" style="width:100%;margin-top:10px;">Volver a iniciar sesión</button>
    </div>
  `;
  document.getElementById("sr-back").onclick = () => renderLoginScreen();

  const estSelect = document.getElementById("sr-establishment");
  try {
    const { establishments } = await Api.get("/establishments/public");
    estSelect.innerHTML = establishments.length === 0
      ? '<option value="">No hay establecimientos registrados todavía</option>'
      : establishments.map((e) => `<option value="${e.id}">${e.name}${e.company_name ? " — " + e.company_name : ""}</option>`).join("");
  } catch (err) {
    estSelect.innerHTML = '<option value="">No se pudo cargar la lista</option>';
  }

  document.getElementById("sr-submit").onclick = async () => {
    const errEl = document.getElementById("sr-error");
    errEl.textContent = "";
    const email = document.getElementById("sr-email").value.trim();
    try {
      const data = await Api.post("/auth/register", {
        name: document.getElementById("sr-name").value.trim(),
        email,
        phone: document.getElementById("sr-phone").value.trim(),
        password: document.getElementById("sr-password").value,
        establishmentId: estSelect.value || undefined,
      });
      if (!["ADMIN", "ATTENDANT"].includes(data.user.role)) {
        errEl.textContent = "Ese correo no pertenece al dominio de personal (@smartparking-staff.cr), así que se registró como cliente, no como personal.";
        return;
      }
      Api.setToken(data.token);
      state.user = data.user;
      state.parkings = [];
      state.currentParkingId = null;
      afterLogin();
    } catch (err) {
      errEl.textContent = err.message;
    }
  };
}

function afterLogin() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("shell").style.display = "flex";
  whoAmI.textContent = `${fullName(state.user) || state.user.email}, ${state.user.role === "ADMIN" ? "Administración" : "Guarda de seguridad"}`;
  document.getElementById("brand-sub").textContent = state.user.role === "ADMIN" ? "Panel administrativo" : "Panel de seguridad";
  sideNav.querySelectorAll(".admin-only").forEach((btn) => {
    btn.classList.toggle("hidden", state.user.role !== "ADMIN");
  });
  navigate("#/dashboard");
}

// ---------------------------------------------------------------------------
// ROUTER
// ---------------------------------------------------------------------------
const routes = {
  "#/dashboard": renderDashboard,
  "#/entries": renderEntries,
  "#/exits": renderExits,
  "#/parking": renderParkingMap,
  "#/reservations": renderReservations,
  "#/spaces": renderSpaces,
  "#/establishments": renderEstablishments,
  "#/staff": renderStaff,
  "#/stats": renderStats,
};

function navigate(route) { window.location.hash = route; }

async function router() {
  if (!Api.getToken()) return renderLoginScreen();
  if (!state.user) {
    try {
      const { user } = await Api.get("/auth/me");
      state.user = user;
    } catch (e) {
      Api.clearToken();
      return renderLoginScreen();
    }
  }
  document.getElementById("login-screen") && (document.getElementById("login-screen").style.display = "none");
  document.getElementById("shell").style.display = "flex";
  whoAmI.textContent = `${fullName(state.user) || state.user.email}, ${state.user.role === "ADMIN" ? "Administración" : "Guarda de seguridad"}`;
  document.getElementById("brand-sub").textContent = state.user.role === "ADMIN" ? "Panel administrativo" : "Panel de seguridad";
  sideNav.querySelectorAll(".admin-only").forEach((btn) => btn.classList.toggle("hidden", state.user.role !== "ADMIN"));

  const route = window.location.hash || "#/dashboard";
  sideNav.querySelectorAll(".side-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.route === route));

  const titles = {
    "#/dashboard": "Panel general",
    "#/entries": "Entradas",
    "#/exits": "Salidas",
    "#/parking": "Mapa del parqueo",
    "#/reservations": "Reservas",
    "#/spaces": "Gestión de espacios",
    "#/establishments": "Establecimientos",
    "#/staff": "Personal",
    "#/stats": "Estadísticas",
  };
  pageTitle.textContent = titles[route] || "Panel";

  const handler = routes[route] || renderDashboard;
  try {
    await handler();
  } catch (err) {
    viewEl.innerHTML = `<div class="card"><p class="error-text">${escapeHtml(err.message)}</p></div>`;
  }
}

window.addEventListener("hashchange", router);
sideNav.addEventListener("click", (e) => {
  const btn = e.target.closest(".side-btn");
  if (btn) navigate(btn.dataset.route);
});
document.getElementById("logout-btn").onclick = () => {
  Api.clearToken();
  state.user = null;
  window.location.hash = "";
  renderLoginScreen();
};

// ---------------------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------------------
async function renderDashboard() {
  const id = estId();
  if (!id) {
    viewEl.innerHTML = `<div class="card"><p>Tu cuenta no tiene un establecimiento asignado.</p></div>`;
    return;
  }
  const { current, occupancyRatePercent } = await Api.get(`/stats/${id}/summary`);
  const { entries } = await Api.get("/entries/open");

  viewEl.innerHTML = `
    <div class="grid-3">
      <div class="card"><div class="stat-label">Disponibles</div><div class="stat-value" style="color:var(--available)">${current.AVAILABLE}</div></div>
      <div class="card"><div class="stat-label">Reservados</div><div class="stat-value" style="color:var(--reserved)">${current.RESERVED}</div></div>
      <div class="card"><div class="stat-label">Ocupados</div><div class="stat-value" style="color:var(--primary)">${current.OCCUPIED}</div></div>
    </div>
    <div class="card">
      <div class="stat-label">Ocupación total</div>
      <div class="stat-value">${occupancyRatePercent}%</div>
      <p class="muted">${current.TOTAL} espacios en total · ${current.BLOCKED} bloqueados</p>
    </div>
    <div class="card">
      <h3 style="margin-top:0;">Vehículos actualmente dentro (${entries.length})</h3>
      ${entries.length === 0 ? '<p class="muted">No hay vehículos dentro en este momento.</p>' :
        `<table><thead><tr><th>Espacio</th><th>Parqueo</th><th>Conductor</th><th>Entrada</th><th>Origen</th></tr></thead><tbody>
          ${entries.map(e => `<tr>
            <td>${escapeHtml(e.space_code)}</td>
            <td>${escapeHtml(e.parking_name)}</td>
            <td>${escapeHtml(fullName(e, "user_") || "Sin registrar (walk-in)")}</td>
            <td>${new Date(e.entry_time).toLocaleString()}</td>
            <td>${e.entry_method === 'RESERVATION' ? 'Reserva' : 'Sin reserva'}</td>
          </tr>`).join("")}
        </tbody></table>`}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// ENTRADAS: escanear/pegar QR + asignación manual (walk-in)
// ---------------------------------------------------------------------------
async function renderEntries() {
  const available = (await getAllSpacesFlat()).filter((s) => s.status === "AVAILABLE");

  viewEl.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <h3 style="margin-top:0;">Validar reserva por QR</h3>
        <p class="muted">Pega el contenido leído del código QR del conductor (el lector de cámara envía este mismo texto).</p>
        <div class="input-group"><label>Contenido del QR</label><textarea id="qr-input" rows="3" placeholder="Contenido escaneado..."></textarea></div>
        <p class="error-text" id="qr-error"></p>
        <p class="success-text" id="qr-success"></p>
        <button class="btn" id="qr-submit">Validar e ingresar</button>
      </div>
      <div class="card">
        <h3 style="margin-top:0;">Registrar entrada sin reserva</h3>
        <p class="muted">Asigna manualmente un espacio disponible a un conductor que llegó sin reservar.</p>
        <div class="input-group">
          <label>Espacio disponible</label>
          <select id="walkin-space">
            ${available.length === 0 ? '<option value="">No hay espacios disponibles</option>' :
              available.map((s) => `<option value="${s.id}">${escapeHtml(s.parking_name)} · ${escapeHtml(s.code)} (${escapeHtml(s.row_location || "")})</option>`).join("")}
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
    const okEl = document.getElementById("qr-success");
    errEl.textContent = ""; okEl.textContent = "";
    try {
      const data = await Api.post("/entries/scan-qr", { signedPayload: document.getElementById("qr-input").value.trim() });
      okEl.textContent = `Ingreso autorizado: espacio ${data.space.code} para ${data.user ? (fullName(data.user) || data.user.email) : "conductor"}.`;
      document.getElementById("qr-input").value = "";
    } catch (err) {
      errEl.textContent = err.message;
    }
  };

  document.getElementById("walkin-submit").onclick = async () => {
    const errEl = document.getElementById("walkin-error");
    const okEl = document.getElementById("walkin-success");
    errEl.textContent = ""; okEl.textContent = "";
    try {
      const spaceId = document.getElementById("walkin-space").value;
      const data = await Api.post("/entries/walk-in", { spaceId });
      okEl.textContent = `Entrada registrada en el espacio ${data.space.code}.`;
      renderEntries();
    } catch (err) {
      errEl.textContent = err.message;
    }
  };
}

// ---------------------------------------------------------------------------
// SALIDAS
// ---------------------------------------------------------------------------
async function renderExits() {
  const { entries } = await Api.get("/entries/open");

  viewEl.innerHTML = `
    <div class="card">
      <h3 style="margin-top:0;">Vehículos dentro del parqueo</h3>
      ${entries.length === 0 ? '<p class="muted">No hay vehículos dentro.</p>' :
        `<table><thead><tr><th>Espacio</th><th>Parqueo</th><th>Conductor</th><th>Hora de entrada</th><th></th></tr></thead><tbody>
          ${entries.map(e => `<tr>
            <td>${escapeHtml(e.space_code)}</td>
            <td>${escapeHtml(e.parking_name)}</td>
            <td>${escapeHtml(fullName(e, "user_") || "Sin registrar (walk-in)")}</td>
            <td>${new Date(e.entry_time).toLocaleString()}</td>
            <td><button class="btn secondary exit-btn" data-space="${e.space_id}">Registrar salida</button></td>
          </tr>`).join("")}
        </tbody></table>`}
      <p class="error-text" id="exit-error"></p>
    </div>
  `;

  viewEl.querySelectorAll(".exit-btn").forEach((btn) => {
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
// MAPA DEL PARQUEO (vista en tiempo real, con bloqueo/desbloqueo para ADMIN)
// ---------------------------------------------------------------------------
async function renderParkingMap() {
  const { parkings, establishment } = await Api.get(`/establishments/${estId()}/map`);
  const isAdmin = state.user.role === "ADMIN";

  const parkingNames = Object.keys(parkings);
  let html = "";

  if (parkingNames.length > 0) {
    const flatSpaces = [];
    for (const parkingName of parkingNames) {
      for (const [rowLabel, spaces] of Object.entries(parkings[parkingName])) {
        spaces.forEach((s) => flatSpaces.push({ ...s, row_location: rowLabel }));
      }
    }
    html += renderParking3DBlock(flatSpaces, establishment.name);
  }

  html += `<div class="card">
    <div class="legend-row">
      <span><span class="dot AVAILABLE"></span>Disponible</span>
      <span><span class="dot RESERVED"></span>Reservado</span>
      <span><span class="dot OCCUPIED"></span>Ocupado</span>
      <span><span class="dot BLOCKED"></span>Bloqueado</span>
    </div>`;

  if (parkingNames.length === 0) {
    html += `<p class="muted">Este establecimiento todavía no tiene parqueos/espacios configurados.</p>`;
  }

  for (const parkingName of parkingNames) {
    html += `<div class="parking-block-title">${escapeHtml(parkingName)}</div>`;
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

// ---------------------------------------------------------------------------
// RESERVAS
// ---------------------------------------------------------------------------
async function renderReservations() {
  const id = estId();
  viewEl.innerHTML = `
    <div class="card">
      <div class="input-group" style="max-width:220px;">
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
      : `<table><thead><tr><th>Conductor</th><th>Parqueo</th><th>Espacio</th><th>Creada</th><th>Vence</th><th>Estado</th></tr></thead><tbody>
          ${reservations.map(r => `<tr>
            <td>${escapeHtml(fullName(r, "user_") || r.user_email)}</td>
            <td>${escapeHtml(r.parking_name)}</td>
            <td>${escapeHtml(r.space_code)}</td>
            <td>${new Date(r.created_at).toLocaleString()}</td>
            <td>${new Date(r.end_time).toLocaleString()}</td>
            <td><span class="badge ${r.status}">${r.status}</span></td>
          </tr>`).join("")}
        </tbody></table>`;
  }
  document.getElementById("status-filter").onchange = load;
  load();
}

// ---------------------------------------------------------------------------
// GESTIÓN DE ESPACIOS (solo ADMIN) — primero elige el parqueo
// ---------------------------------------------------------------------------
async function renderSpaces() {
  const parkings = await loadParkings();
  if (parkings.length === 0) {
    viewEl.innerHTML = `<div class="card"><p>Este establecimiento todavía no tiene ningún parqueo creado.</p>
      <button class="btn" id="go-parkings">Crear un parqueo primero</button></div>`;
    document.getElementById("go-parkings").onclick = () => navigate("#/establishments");
    return;
  }
  if (!state.currentParkingId) state.currentParkingId = parkings[0].id;

  const { spaces } = await Api.get(`/spaces/parking/${state.currentParkingId}`);

  viewEl.innerHTML = `
    <div class="card">
      <div class="input-group" style="max-width:280px;">
        <label>Parqueo</label>
        <select id="parking-select">
          ${parkings.map(p => `<option value="${p.id}" ${p.id === state.currentParkingId ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}
        </select>
      </div>
    </div>
    <div class="card">
      <h3 style="margin-top:0;">Crear espacio</h3>
      <div class="grid-2">
        <div class="input-group"><label>Código (ej: A01)</label><input id="sp-code" /></div>
        <div class="input-group"><label>Fila / ubicación</label><input id="sp-row" placeholder="Fila A" /></div>
      </div>
      <p class="error-text" id="sp-error"></p>
      <button class="btn" id="sp-submit">Agregar espacio</button>
    </div>
    <div class="card">
      <h3 style="margin-top:0;">Espacios existentes (${spaces.length})</h3>
      <table><thead><tr><th>Código</th><th>Fila</th><th>Estado</th><th></th></tr></thead><tbody>
        ${spaces.map(s => `<tr>
          <td>${escapeHtml(s.code)}</td>
          <td>${escapeHtml(s.row_location || "-")}</td>
          <td><span class="badge ${s.status}">${s.status}</span></td>
          <td>
            <button class="btn secondary block-btn" data-id="${s.id}" data-status="${s.status}">${s.status === "BLOCKED" ? "Desbloquear" : "Bloquear"}</button>
            <button class="btn danger del-btn" data-id="${s.id}">Eliminar</button>
          </td>
        </tr>`).join("")}
      </tbody></table>
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
    } catch (err) {
      errEl.textContent = err.message;
    }
  };

  viewEl.querySelectorAll(".block-btn").forEach((btn) => {
    btn.onclick = async () => {
      await Api.patch(`/spaces/${btn.dataset.id}/blocked`, { blocked: btn.dataset.status !== "BLOCKED" });
      renderSpaces();
    };
  });
  viewEl.querySelectorAll(".del-btn").forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm("¿Eliminar este espacio?")) return;
      try {
        await Api.delete(`/spaces/${btn.dataset.id}`);
        renderSpaces();
      } catch (err) {
        alert(err.message);
      }
    };
  });
}

// ---------------------------------------------------------------------------
// ESTABLECIMIENTOS Y PARQUEOS (solo ADMIN)
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
      <h3 style="margin-top:0;">Crear establecimiento</h3>
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
      <h3 style="margin-top:0;">Establecimientos existentes</h3>
      <table><thead><tr><th>Nombre</th><th>Empresa</th><th>Espacios</th><th>Ubicación</th></tr></thead><tbody>
        ${establishments.map(e => `<tr>
          <td>${escapeHtml(e.name)}</td>
          <td>${escapeHtml(e.company_name)}</td>
          <td>${e.availability.TOTAL}</td>
          <td>${e.latitude != null ? "📍 Ubicado" : '<span class="muted">Sin coordenadas</span>'}</td>
        </tr>`).join("")}
      </tbody></table>
    </div>
    <div class="card">
      <h3 style="margin-top:0;">Crear parqueo (dentro de tu establecimiento)</h3>
      <p class="muted">Los espacios se crean dentro de un parqueo. Un establecimiento puede tener varios.</p>
      <div class="grid-2">
        <div class="input-group"><label>Nombre del parqueo</label><input id="pk-name" placeholder="Parqueo Principal" /></div>
        <div class="input-group"><label>Capacidad</label><input id="pk-capacity" type="number" min="1" /></div>
      </div>
      <p class="error-text" id="pk-error"></p>
      <button class="btn" id="pk-submit">Crear parqueo</button>
      <table style="margin-top:14px;"><thead><tr><th>Parqueo</th><th>Capacidad declarada</th></tr></thead><tbody>
        ${parkings.map(p => `<tr><td>${escapeHtml(p.name)}</td><td>${p.capacity}</td></tr>`).join("") || '<tr><td colspan="2" class="muted">Sin parqueos todavía</td></tr>'}
      </tbody></table>
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
    } catch (err) {
      errEl.textContent = err.message;
    }
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
    } catch (err) {
      errEl.textContent = err.message;
    }
  };
}

// ---------------------------------------------------------------------------
// PERSONAL (solo ADMIN) - crear cuentas ATTENDANT/ADMIN
// ---------------------------------------------------------------------------
async function renderStaff() {
  const id = estId();
  const { users } = await Api.get(`/users/staff/${id}`);

  viewEl.innerHTML = `
    <div class="card">
      <h3 style="margin-top:0;">Registrar personal</h3>
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
      <h3 style="margin-top:0;">Personal registrado</h3>
      <table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th></tr></thead><tbody>
        ${users.map(u => `<tr><td>${escapeHtml(fullName(u))}</td><td>${escapeHtml(u.email)}</td><td><span class="badge role-pill">${u.role_name}</span></td></tr>`).join("")}
      </tbody></table>
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
    } catch (err) {
      errEl.textContent = err.message;
    }
  };
}

// ---------------------------------------------------------------------------
// ESTADÍSTICAS Y PREDICCIÓN (solo ADMIN)
// ---------------------------------------------------------------------------
async function renderStats() {
  const id = estId();
  const { current, occupancyRatePercent } = await Api.get(`/stats/${id}/summary`);
  const { prediction, weekdayHistory } = await Api.get(`/stats/${id}/prediction`);

  viewEl.innerHTML = `
    <div class="grid-3">
      <div class="card"><div class="stat-label">Ocupación actual</div><div class="stat-value">${occupancyRatePercent}%</div></div>
      <div class="card"><div class="stat-label">Espacios ocupados</div><div class="stat-value">${current.OCCUPIED}</div></div>
      <div class="card"><div class="stat-label">Total de espacios</div><div class="stat-value">${current.TOTAL}</div></div>
    </div>
    <div class="card">
      <h3 style="margin-top:0;">Predicción de ocupación por hora</h3>
      ${!prediction.available ? `<p class="muted">${prediction.message}</p>` :
        `<table><thead><tr><th>Hora</th><th>Entradas históricas</th><th>Nivel estimado</th></tr></thead><tbody>
          ${prediction.hours.map(h => `<tr><td>${h.label}</td><td>${h.entriesHistorically}</td><td><span class="badge ${h.level === 'ALTA' ? 'OCCUPIED' : h.level === 'MEDIA' ? 'RESERVED' : 'AVAILABLE'}">${h.level}</span></td></tr>`).join("")}
        </tbody></table>`}
    </div>
    <div class="card">
      <h3 style="margin-top:0;">Historial por día de la semana</h3>
      ${weekdayHistory.length === 0 ? '<p class="muted">Sin datos históricos todavía.</p>' :
        `<table><thead><tr><th>Día</th><th>Entradas registradas</th></tr></thead><tbody>
          ${weekdayHistory.map(w => `<tr><td>${w.name}</td><td>${w.entriesHistorically}</td></tr>`).join("")}
        </tbody></table>`}
    </div>
  `;
}

router();
