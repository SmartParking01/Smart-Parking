// =============================================================================
// Smart Parking · App Conductor (Dark Premium)
// =============================================================================

const view = document.getElementById("app-view");
const headerTitle = document.getElementById("header-title");
const backBtn = document.getElementById("btn-back");
const bottomNav = document.getElementById("bottom-nav");

let state = {
  user: null,
  establishments: [],
  currentEstablishmentId: null,
  currentSpaces: [],
  selectedSpaceId: null,
  lastReservationId: null,
  lastQrImage: null,
  geoMap: null,
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}
function setTitle(title) { headerTitle.textContent = title; }
function showLoading() { view.innerHTML = `<div class="spinner"></div>`; }

const AUTH_FREE_ROUTES = ["#/login", "#/register", "#/forgot"];

// ---------------------------------------------------------------------------
// ROUTER
// ---------------------------------------------------------------------------
const routes = {
  "#/login":         renderLogin,
  "#/register":      renderRegister,
  "#/forgot":        renderForgot,
  "#/home":          renderHome,
  "#/map":           renderMap,
  "#/establishment": renderEstablishment,
  "#/reserve":       renderReserveConfirm,
  "#/qr":            renderQr,
  "#/reservations":  renderHistory,
  "#/history":       renderHistory,
  "#/profile":       renderProfile,
};

function navigate(route) { window.location.hash = route; }

async function router() {
  let route = window.location.hash || "#/login";
  const [base] = route.split("?");

  if (!Api.getToken() && !AUTH_FREE_ROUTES.includes(base)) {
    return navigate("#/login");
  }
  if (Api.getToken() && AUTH_FREE_ROUTES.includes(base)) {
    return navigate("#/home");
  }

  const isTopLevel = ["#/home", "#/map", "#/reservations", "#/history", "#/profile"].includes(base);
  backBtn.classList.toggle("visible", !isTopLevel && !AUTH_FREE_ROUTES.includes(base));
  bottomNav.style.display = AUTH_FREE_ROUTES.includes(base) ? "none" : "flex";

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.route === base);
  });

  const handler = routes[base] || renderHome;
  try { await handler(); }
  catch (err) {
    view.innerHTML = `<div class="card"><p class="error-text">${escapeHtml(err.message)}</p></div>`;
  }
}

window.addEventListener("hashchange", router);
backBtn.addEventListener("click", () => window.history.back());
bottomNav.addEventListener("click", (e) => {
  const btn = e.target.closest(".nav-btn");
  if (btn) navigate(btn.dataset.route);
});

// ---------------------------------------------------------------------------
// LOGIN / REGISTER / FORGOT
// ---------------------------------------------------------------------------
function renderLogin() {
  setTitle("Smart Parking");
  view.innerHTML = `
    <div class="card hero" style="text-align:center">
      <h2>Smart Parking</h2>
      <p>Encuentra y reserva tu espacio en segundos</p>
    </div>
    <div class="card">
      <div class="input-group">
        <label>Correo electrónico</label>
        <input type="email" id="login-email" placeholder="correo@ejemplo.com" />
      </div>
      <div class="input-group">
        <label>Contraseña</label>
        <input type="password" id="login-password" placeholder="••••••••" />
      </div>
      <p class="error-text" id="login-error"></p>
      <button class="btn" id="login-submit">Iniciar sesión</button>
      <button class="link-btn" id="go-forgot" style="width:100%;text-align:center">¿Olvidaste tu contraseña?</button>
      <button class="link-btn" id="go-register" style="width:100%;text-align:center">Crear una cuenta nueva</button>
    </div>
  `;

  document.getElementById("go-register").onclick = () => navigate("#/register");
  document.getElementById("go-forgot").onclick = () => navigate("#/forgot");
  document.getElementById("login-submit").onclick = async () => {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const errEl = document.getElementById("login-error");
    errEl.textContent = "";
    try {
      const data = await Api.post("/auth/login", { email, password });
      if (data.user.role !== "USER") {
        errEl.textContent = "Esta app es para conductores. Usa el panel administrativo para tu rol.";
        return;
      }
      Api.setToken(data.token);
      state.user = data.user;
      navigate("#/home");
    } catch (err) { errEl.textContent = err.message; }
  };
}

function renderRegister() {
  setTitle("Crear cuenta");
  view.innerHTML = `
    <div class="card">
      <div class="input-group"><label>Nombre completo</label><input id="r-name" /></div>
      <div class="input-group"><label>Correo electrónico</label><input id="r-email" type="email" /></div>
      <div class="input-group"><label>Teléfono</label><input id="r-phone" /></div>
      <div class="input-group"><label>Contraseña</label><input id="r-password" type="password" /></div>
      <p class="error-text" id="r-error"></p>
      <button class="btn" id="r-submit">Registrarme</button>
      <button class="link-btn" id="r-goLogin" style="width:100%;text-align:center">Ya tengo cuenta</button>
    </div>
  `;
  document.getElementById("r-goLogin").onclick = () => navigate("#/login");
  document.getElementById("r-submit").onclick = async () => {
    const errEl = document.getElementById("r-error");
    errEl.textContent = "";
    try {
      const data = await Api.post("/auth/register", {
        name: document.getElementById("r-name").value.trim(),
        email: document.getElementById("r-email").value.trim(),
        phone: document.getElementById("r-phone").value.trim(),
        password: document.getElementById("r-password").value,
      });
      Api.setToken(data.token);
      state.user = data.user;
      navigate("#/home");
    } catch (err) { errEl.textContent = err.message; }
  };
}

function renderForgot() {
  setTitle("Recuperar contraseña");
  view.innerHTML = `
    <div class="card">
      <p>Ingresa tu correo. Si existe una cuenta, se generará un enlace de recuperación.</p>
      <div class="input-group"><label>Correo electrónico</label><input id="f-email" type="email" /></div>
      <p class="success-text" id="f-msg"></p>
      <button class="btn" id="f-submit">Enviar</button>
      <button class="link-btn" id="f-goLogin" style="width:100%;text-align:center">Volver a iniciar sesión</button>
    </div>
  `;
  document.getElementById("f-goLogin").onclick = () => navigate("#/login");
  document.getElementById("f-submit").onclick = async () => {
    const msgEl = document.getElementById("f-msg");
    try {
      const data = await Api.post("/auth/forgot-password", {
        email: document.getElementById("f-email").value.trim(),
      });
      msgEl.textContent = data.message;
    } catch (err) { msgEl.textContent = err.message; }
  };
}

// ---------------------------------------------------------------------------
// HOME
// ---------------------------------------------------------------------------
function availabilityLevel(av) {
  if (!av || av.TOTAL === 0) return "low";
  const ratio = av.AVAILABLE / av.TOTAL;
  if (ratio >= 0.5) return "high";
  if (ratio >= 0.2) return "mid";
  return "low";
}

function makePinIcon(selected, letter) {
  return L.divIcon({
    className: "",
    html: `<div class="map-pin-icon${selected ? " selected" : ""}"><span>${escapeHtml((letter || "P").charAt(0).toUpperCase())}</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 24],
    popupAnchor: [0, -22],
  });
}

async function renderHome() {
  setTitle("Smart Parking");
  showLoading();

  const { establishments } = await Api.get("/establishments");
  state.establishments = establishments;

  const userFirst = state.user?.first_name || "";
  const greeting = userFirst ? `¡Hola, ${escapeHtml(userFirst)}!` : "¡Hola!";

  if (establishments.length === 0) {
    view.innerHTML = `
      <div class="card hero">
        <h2>${greeting}</h2>
        <p>¿A dónde vamos hoy?</p>
      </div>
      <div class="card empty-state">
        <span class="mark">Sin establecimientos</span>
        <p>No hay establecimientos registrados todavía.</p>
      </div>`;
    return;
  }

  const withCoords = establishments.filter(e => e.latitude != null && e.longitude != null);

  view.innerHTML = `
    <div class="card hero" style="margin-top:0">
      <h2>${greeting}</h2>
      <p>¿A dónde vamos hoy?</p>
    </div>

    <div class="input-group" style="margin-bottom:14px">
      <input type="text" placeholder="Buscar parqueos, centros comerciales..." />
    </div>

    <div class="home-actions">
      <div class="home-action a-blue" id="qa-map">
        <div class="home-action-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s-8-8-8-13a8 8 0 1116 0c0 5-8 13-8 13z"/><circle cx="12" cy="9" r="2.5"/></svg>
        </div>
        <span>Mapa</span>
      </div>
      <div class="home-action a-green" id="qa-reserve">
        <div class="home-action-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
        </div>
        <span>Reservar</span>
      </div>
      <div class="home-action a-yellow" id="qa-myreservations">
        <div class="home-action-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
        </div>
        <span>Mis reservas</span>
      </div>
      <div class="home-action a-slate" id="qa-profile">
        <div class="home-action-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
        </div>
        <span>Perfil</span>
      </div>
    </div>

    ${withCoords.length > 0 ? '<div id="geo-map"></div>' : ""}

    <div style="display:flex;justify-content:space-between;align-items:center;margin:18px 0 8px">
      <h3 style="margin:0">Parqueos cercanos</h3>
      <a href="#/map" class="link-btn" style="font-size:12px">Ver todos</a>
    </div>
    <div class="card" id="establishment-list" style="padding:6px 8px"></div>
  `;

  document.getElementById("qa-map").onclick          = () => navigate("#/map");
  document.getElementById("qa-myreservations").onclick = () => navigate("#/reservations");
  document.getElementById("qa-profile").onclick        = () => navigate("#/profile");
  document.getElementById("qa-reserve").onclick        = () => {
    if (establishments[0]) {
      state.currentEstablishmentId = establishments[0].id;
      navigate("#/establishment");
    }
  };

  const listEl = document.getElementById("establishment-list");
  listEl.innerHTML = establishments.map(e => {
    const level = availabilityLevel(e.availability);
    return `
      <div class="establishment-item" data-id="${e.id}">
        <div class="establishment-icon">${escapeHtml((e.name || "P").charAt(0).toUpperCase())}</div>
        <div class="establishment-info">
          <h3>${escapeHtml(e.name)}</h3>
          <p>${escapeHtml(e.address || "Dirección no especificada")}</p>
          <span class="availability-pill ${level}">● ${e.availability.AVAILABLE} de ${e.availability.TOTAL} libres</span>
        </div>
      </div>`;
  }).join("");

  listEl.querySelectorAll(".establishment-item").forEach(item => {
    item.onclick = () => {
      state.currentEstablishmentId = item.dataset.id;
      navigate("#/establishment");
    };
  });

  if (withCoords.length > 0) {
    const mapEl = document.getElementById("geo-map");
    const map = L.map(mapEl, { zoomControl: false, attributionControl: false })
      .setView([withCoords[0].latitude, withCoords[0].longitude], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

    const markers = [];
    withCoords.forEach(e => {
      const marker = L.marker([e.latitude, e.longitude], { icon: makePinIcon(false, e.name) }).addTo(map);
      marker.bindPopup(`<strong>${escapeHtml(e.name)}</strong><br>${e.availability.AVAILABLE} de ${e.availability.TOTAL} libres`);
      marker.on("click", () => {
        state.currentEstablishmentId = e.id;
        navigate("#/establishment");
      });
      markers.push(marker);
    });

    if (markers.length > 1) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.25));
    }
  }
}

// ---------------------------------------------------------------------------
// MAP — pantalla de mapa grande con parqueos cercanos
// ---------------------------------------------------------------------------
async function renderMap() {
  setTitle("Parqueos cercanos");
  showLoading();

  const { establishments } = await Api.get("/establishments");
  state.establishments = establishments;

  const withCoords = establishments.filter(e => e.latitude != null && e.longitude != null);

  view.innerHTML = `
    <div class="input-group" style="margin-bottom:14px">
      <input type="text" placeholder="Buscar en esta zona..." />
    </div>

    ${withCoords.length > 0
      ? '<div id="mini-map" style="height:320px"></div>'
      : '<div class="card"><p class="muted">Ningún establecimiento tiene coordenadas registradas todavía.</p></div>'}

    <h3 style="margin:16px 0 8px">Todos los parqueos</h3>
    <div id="map-establishment-list"></div>
  `;

  const listEl = document.getElementById("map-establishment-list");
  if (establishments.length === 0) {
    listEl.innerHTML = `<div class="card empty-state"><span class="mark">Sin parqueos</span><p>No hay parqueos registrados.</p></div>`;
  } else {
    listEl.innerHTML = establishments.map(e => {
      const level = availabilityLevel(e.availability);
      return `
        <div class="card establishment-card" data-id="${e.id}" style="cursor:pointer">
          <div style="display:flex;gap:13px;align-items:center">
            <div class="establishment-icon">${escapeHtml((e.name || "P").charAt(0).toUpperCase())}</div>
            <div class="establishment-info" style="flex:1">
              <h3>${escapeHtml(e.name)}</h3>
              <p>${escapeHtml(e.address || "Dirección no especificada")}</p>
              <span class="availability-pill ${level}">● ${e.availability.AVAILABLE} de ${e.availability.TOTAL} libres</span>
            </div>
          </div>
        </div>`;
    }).join("");

    listEl.querySelectorAll(".establishment-card").forEach(card => {
      card.onclick = () => {
        state.currentEstablishmentId = card.dataset.id;
        navigate("#/establishment");
      };
    });
  }

  if (withCoords.length > 0) {
    const mapEl = document.getElementById("mini-map");
    const map = L.map(mapEl, { zoomControl: true, attributionControl: false })
      .setView([withCoords[0].latitude, withCoords[0].longitude], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

    const markers = [];
    withCoords.forEach(e => {
      const marker = L.marker([e.latitude, e.longitude], { icon: makePinIcon(false, e.name) }).addTo(map);
      marker.bindPopup(`<strong>${escapeHtml(e.name)}</strong><br>${e.availability.AVAILABLE} de ${e.availability.TOTAL} libres`);
      marker.on("click", () => {
        state.currentEstablishmentId = e.id;
        navigate("#/establishment");
      });
      markers.push(marker);
    });

    if (markers.length > 1) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.25));
    }
  }
}

// ---------------------------------------------------------------------------
// ESTABLECIMIENTO — mapa visual de espacios y reserva
// ---------------------------------------------------------------------------
async function renderEstablishment() {
  setTitle("Mapa del parqueo");
  showLoading();

  const id = state.currentEstablishmentId;
  if (!id) return navigate("#/home");

  const { parkings, establishment } = await Api.get(`/establishments/${id}/map`);
  state.selectedSpaceId = null;

  let html = `
    <div class="card">
      <h2>${escapeHtml(establishment.name)}</h2>
      <p>Selecciona un espacio disponible para reservarlo.</p>
      <div class="legend-row">
        <span><span class="dot AVAILABLE"></span>Libre</span>
        <span><span class="dot RESERVED"></span>Reservado</span>
        <span><span class="dot OCCUPIED"></span>Ocupado</span>
        <span><span class="dot BLOCKED"></span>Bloqueado</span>
      </div>
    </div>`;

  const parkingNames = Object.keys(parkings);
  if (parkingNames.length === 0) {
    html += `<div class="card empty-state"><span class="mark">Sin espacios</span><p>Este establecimiento todavía no tiene espacios configurados.</p></div>`;
    view.innerHTML = html;
    return;
  }

  html += `<div class="card">`;
  for (const parkingName of parkingNames) {
    html += `<div class="parking-block-title">${escapeHtml(parkingName)}</div>`;
    const rows = parkings[parkingName];
    for (const [rowLabel, spaces] of Object.entries(rows)) {
      html += `<div class="row-label">${escapeHtml(rowLabel)}</div><div class="space-grid">`;
      for (const s of spaces) {
        html += `<div class="space-cell ${s.status}" data-id="${s.id}" data-status="${s.status}">${escapeHtml(s.code)}</div>`;
      }
      html += `</div>`;
    }
  }
  html += `</div>
    <button class="btn" id="reserve-btn" disabled>Reservar espacio seleccionado</button>`;

  view.innerHTML = html;

  view.querySelectorAll(".space-cell").forEach(cell => {
    cell.onclick = () => {
      if (cell.dataset.status !== "AVAILABLE") return;
      view.querySelectorAll(".space-cell").forEach(c => c.classList.remove("selected"));
      cell.classList.add("selected");
      state.selectedSpaceId = cell.dataset.id;
      document.getElementById("reserve-btn").disabled = false;
    };
  });

  document.getElementById("reserve-btn").onclick = () => navigate("#/reserve");
}

// ---------------------------------------------------------------------------
// RESERVE — confirmar reserva
// ---------------------------------------------------------------------------
async function renderReserveConfirm() {
  setTitle("Reservar espacio");
  if (!state.selectedSpaceId) return navigate("#/home");

  const est = state.establishments.find(e => String(e.id) === String(state.currentEstablishmentId));
  const estName = est?.name || "Establecimiento";
  const estAddress = est?.address || "";

  view.innerHTML = `
    <div class="card hero">
      <h2>${escapeHtml(estName)}</h2>
      <p>${escapeHtml(estAddress || "Confirma tu reserva")}</p>
    </div>

    <div class="card">
      <h3>Detalle de la reserva</h3>
      <div class="info-row"><span>Espacio seleccionado</span><span id="conf-space">—</span></div>
      <div class="info-row"><span>Duración</span><span>30 minutos</span></div>
      <div class="info-row"><span>Precio estimado</span><span>—</span></div>
    </div>

    <p class="error-text" id="reserve-error"></p>

    <button class="btn yellow" id="confirm-btn">Confirmar reserva</button>
    <button class="btn secondary" id="cancel-btn" style="margin-top:10px">Cancelar</button>
  `;

  document.getElementById("cancel-btn").onclick = () => navigate("#/establishment");
  document.getElementById("confirm-btn").onclick = async () => {
    const errEl = document.getElementById("reserve-error");
    errEl.textContent = "";
    try {
      const data = await Api.post("/reservations", { spaceId: state.selectedSpaceId });
      state.lastReservationId = data.reservation.id;
      state.lastQrImage = data.qr.image;
      navigate("#/qr");
    } catch (err) { errEl.textContent = err.message; }
  };
}

// ---------------------------------------------------------------------------
// QR — mostrar el código generado
// ---------------------------------------------------------------------------
async function renderQr() {
  setTitle("Tu código QR");
  if (!state.lastQrImage) return navigate("#/home");

  view.innerHTML = `
    <div class="card center">
      <h2>¡Reserva confirmada!</h2>
      <p>Muestra este código al guarda al ingresar.</p>
      <img class="qr-image" src="${state.lastQrImage}" alt="Código QR de la reserva" />
      <button class="btn" id="go-home-btn">Ir al inicio</button>
    </div>
  `;
  document.getElementById("go-home-btn").onclick = () => navigate("#/home");
}

// ---------------------------------------------------------------------------
// HISTORY — listado de reservas del usuario
// ---------------------------------------------------------------------------
async function renderHistory() {
  setTitle("Mis reservas");
  showLoading();

  const { reservations } = await Api.get("/reservations/mine");

  if (!reservations || reservations.length === 0) {
    view.innerHTML = `<div class="card empty-state"><span class="mark">Sin reservas</span><p>Todavía no tienes reservas.</p></div>`;
    return;
  }

  view.innerHTML = `<div class="card">` +
    reservations.map(r => `
      <div class="list-item">
        <div>
          <strong>${escapeHtml(r.parking_name || "Parqueo")}</strong>
          <p>Espacio ${escapeHtml(r.space_code || "")} · ${new Date(r.created_at).toLocaleString()}</p>
        </div>
        <span class="badge ${r.status}">${r.status}</span>
      </div>`).join("") +
    `</div>`;
}

// ---------------------------------------------------------------------------
// PROFILE
// ---------------------------------------------------------------------------
async function renderProfile() {
  setTitle("Mi perfil");
  showLoading();

  const { user } = await Api.get("/auth/me");
  state.user = user;

  const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();

  view.innerHTML = `
    <div class="card">
      <h2>${escapeHtml(fullName || user.email)}</h2>
      <p>${escapeHtml(user.email)}</p>
      <p>${escapeHtml(user.phone || "Sin teléfono registrado")}</p>
    </div>

    <button class="btn danger" id="logout-btn">Cerrar sesión</button>
  `;
  document.getElementById("logout-btn").onclick = () => {
    Api.clearToken();
    state.user = null;
    navigate("#/login");
  };
}

// Arranca el router
router();