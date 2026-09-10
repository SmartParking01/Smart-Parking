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
  geoMap: null, // instancia de Leaflet
};

// ---------------------------------------------------------------------------
// Router muy simple basado en hash, apropiado para una SPA tipo app móvil.
// ---------------------------------------------------------------------------
const routes = {
  "#/login": renderLogin,
  "#/register": renderRegister,
  "#/forgot": renderForgot,
  "#/home": renderHome,
  "#/establishment": renderEstablishment,
  "#/reserve": renderReserveConfirm,
  "#/qr": renderQr,
  "#/history": renderHistory,
  "#/profile": renderProfile,
};

const AUTH_FREE_ROUTES = ["#/login", "#/register", "#/forgot"];

function navigate(route) {
  window.location.hash = route;
}

async function router() {
  let route = window.location.hash || "#/login";
  const [base] = route.split("?");

  if (!Api.getToken() && !AUTH_FREE_ROUTES.includes(base)) {
    return navigate("#/login");
  }
  if (Api.getToken() && AUTH_FREE_ROUTES.includes(base)) {
    return navigate("#/home");
  }

  const isTopLevel = ["#/home", "#/history", "#/profile"].includes(base);
  backBtn.classList.toggle("visible", !isTopLevel && !AUTH_FREE_ROUTES.includes(base));
  bottomNav.style.display = AUTH_FREE_ROUTES.includes(base) ? "none" : "flex";

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.route === base);
  });

  const handler = routes[base] || renderHome;
  try {
    await handler();
  } catch (err) {
    view.innerHTML = `<div class="card"><p class="error-text">${escapeHtml(err.message)}</p></div>`;
  }
}

window.addEventListener("hashchange", router);
backBtn.addEventListener("click", () => window.history.back());
bottomNav.addEventListener("click", (e) => {
  const btn = e.target.closest(".nav-btn");
  if (btn) navigate(btn.dataset.route);
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function setTitle(title) {
  headerTitle.textContent = title;
}

function showLoading() {
  view.innerHTML = `<div class="spinner"></div>`;
}

// ---------------------------------------------------------------------------
// LOGIN / REGISTRO / RECUPERAR
// ---------------------------------------------------------------------------
function renderLogin() {
  setTitle("Smart Parking");
  view.innerHTML = `
    <div class="card hero center" style="margin-top:8px;">
      <h2>🅿️ Smart Parking</h2>
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
      <button class="link-btn" id="go-forgot" style="width:100%;">¿Olvidaste tu contraseña?</button>
      <button class="link-btn" id="go-register" style="width:100%;">Crear una cuenta nueva</button>
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
    } catch (err) {
      errEl.textContent = err.message;
    }
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
      <button class="link-btn" id="r-goLogin" style="width:100%;">Ya tengo cuenta</button>
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
    } catch (err) {
      errEl.textContent = err.message;
    }
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
      <button class="link-btn" id="f-goLogin" style="width:100%;">Volver a iniciar sesión</button>
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
    } catch (err) {
      msgEl.textContent = err.message;
    }
  };
}

// ---------------------------------------------------------------------------
// HOME - mapa geográfico (Leaflet) + lista de establecimientos
// ---------------------------------------------------------------------------
function availabilityLevel(av) {
  if (av.TOTAL === 0) return "low";
  const ratio = av.AVAILABLE / av.TOTAL;
  if (ratio >= 0.5) return "high";
  if (ratio >= 0.2) return "mid";
  return "low";
}

function makePinIcon(selected) {
  return L.divIcon({
    className: "",
    html: `<div class="map-pin-icon${selected ? " selected" : ""}"><span>🅿️</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 28],
    popupAnchor: [0, -26],
  });
}

async function renderHome() {
  setTitle("Parqueos disponibles");
  showLoading();
  const { establishments } = await Api.get("/establishments");
  state.establishments = establishments;

  if (establishments.length === 0) {
    view.innerHTML = `<div class="card empty-state"><span class="emoji">🅿️</span><p>No hay establecimientos registrados todavía.</p></div>`;
    return;
  }

  const withCoords = establishments.filter((e) => e.latitude != null && e.longitude != null);

  view.innerHTML = `
    ${withCoords.length > 0 ? '<div id="geo-map"></div>' : ""}
    <div class="card" id="establishment-list"></div>
  `;

  const listEl = document.getElementById("establishment-list");
  listEl.innerHTML = establishments
    .map((e) => {
      const level = availabilityLevel(e.availability);
      return `
      <div class="establishment-item" data-id="${e.id}">
        <div class="establishment-icon">🅿️</div>
        <div class="establishment-info">
          <h3>${escapeHtml(e.name)}</h3>
          <p style="margin:0;">${escapeHtml(e.address || "Dirección no especificada")}</p>
          <span class="availability-pill ${level}">${e.availability.AVAILABLE} de ${e.availability.TOTAL} libres</span>
        </div>
      </div>`;
    })
    .join("");

  listEl.querySelectorAll(".establishment-item").forEach((item) => {
    item.onclick = () => {
      state.currentEstablishmentId = item.dataset.id;
      navigate("#/establishment");
    };
  });

  // Mapa geográfico: un pin por cada establecimiento con coordenadas.
  if (withCoords.length > 0) {
    const mapEl = document.getElementById("geo-map");
    const map = L.map(mapEl, { zoomControl: true }).setView(
      [withCoords[0].latitude, withCoords[0].longitude],
      13
    );
    state.geoMap = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    const markers = [];
    withCoords.forEach((e) => {
      const marker = L.marker([e.latitude, e.longitude], { icon: makePinIcon(false) }).addTo(map);
      marker.bindPopup(
        `<strong>${escapeHtml(e.name)}</strong><br/>${e.availability.AVAILABLE} de ${e.availability.TOTAL} libres`
      );
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
// ESTABLECIMIENTO - mapa visual de espacios (cuadrícula por parqueo/fila)
// ---------------------------------------------------------------------------
async function renderEstablishment() {
  setTitle("Mapa del parqueo");
  showLoading();
  const id = state.currentEstablishmentId;
  const { parkings, establishment } = await Api.get(`/establishments/${id}/map`);
  state.selectedSpaceId = null;

  let html = `<div class="card"><h2>${escapeHtml(establishment.name)}</h2>
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
    html += `<div class="card empty-state"><span class="emoji">🚧</span><p>Este establecimiento todavía no tiene espacios configurados.</p></div>`;
    view.innerHTML = html;
    return;
  }

  html += `<div class="card">`;
  for (const parkingName of parkingNames) {
    html += `<div class="parking-block"><div class="parking-block-title">${escapeHtml(parkingName)}</div>`;
    const rows = parkings[parkingName];
    for (const [rowLabel, spaces] of Object.entries(rows)) {
      html += `<div class="row-label">${escapeHtml(rowLabel)}</div><div class="space-grid">`;
      for (const s of spaces) {
        html += `<div class="space-cell ${s.status}" data-id="${s.id}" data-status="${s.status}">${escapeHtml(s.code)}</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  }
  html += `</div>
    <button class="btn" id="reserve-btn" disabled>Reservar espacio seleccionado</button>`;

  view.innerHTML = html;

  view.querySelectorAll(".space-cell").forEach((cell) => {
    cell.onclick = () => {
      if (cell.dataset.status !== "AVAILABLE") return;
      view.querySelectorAll(".space-cell").forEach((c) => c.classList.remove("selected"));
      cell.classList.add("selected");
      state.selectedSpaceId = cell.dataset.id;
      document.getElementById("reserve-btn").disabled = false;
    };
  });

  document.getElementById("reserve-btn").onclick = () => navigate("#/reserve");
}

async function renderReserveConfirm() {
  setTitle("Confirmar reserva");
  if (!state.selectedSpaceId) return navigate("#/establishment");

  view.innerHTML = `
    <div class="card center">
      <h2>Confirmar reserva</h2>
      <p>Se generará un código QR único que deberás mostrar al ingresar. La reserva vence si no la usas a tiempo.</p>
      <p class="error-text" id="reserve-error"></p>
      <button class="btn" id="confirm-btn">Confirmar reserva</button>
      <button class="btn secondary" id="cancel-btn" style="margin-top:10px;">Cancelar</button>
    </div>
  `;

  document.getElementById("cancel-btn").onclick = () => navigate("#/establishment");
  document.getElementById("confirm-btn").onclick = async () => {
    const errEl = document.getElementById("reserve-error");
    try {
      const data = await Api.post("/reservations", { spaceId: state.selectedSpaceId });
      state.lastReservationId = data.reservation.id;
      state.lastQrImage = data.qr.image;
      navigate("#/qr");
    } catch (err) {
      errEl.textContent = err.message;
    }
  };
}

async function renderQr() {
  setTitle("Tu código QR");
  if (!state.lastQrImage) return navigate("#/home");
  view.innerHTML = `
    <div class="card center">
      <h2>¡Reserva confirmada!</h2>
      <p>Muestra este código al guarda de seguridad al ingresar.</p>
      <img class="qr-image" src="${state.lastQrImage}" alt="Código QR de la reserva" />
      <button class="btn" id="go-home-btn">Ir al inicio</button>
    </div>
  `;
  document.getElementById("go-home-btn").onclick = () => navigate("#/home");
}

// ---------------------------------------------------------------------------
// HISTORIAL - reservas pasadas
// ---------------------------------------------------------------------------
async function renderHistory() {
  setTitle("Historial");
  showLoading();
  const { reservations } = await Api.get("/reservations/mine");

  if (reservations.length === 0) {
    view.innerHTML = `<div class="card empty-state"><span class="emoji">🕑</span><p>Todavía no tienes reservas.</p></div>`;
    return;
  }

  view.innerHTML = `<div class="card">` +
    reservations
      .map(
        (r) => `
      <div class="list-item">
        <div>
          <strong>${escapeHtml(r.parking_name)}</strong>
          <p style="margin:2px 0;">Espacio ${escapeHtml(r.space_code)} · ${new Date(r.created_at).toLocaleString()}</p>
        </div>
        <span class="badge ${r.status}">${r.status}</span>
      </div>`
      )
      .join("") +
    `</div>`;
}

// ---------------------------------------------------------------------------
// PERFIL
// ---------------------------------------------------------------------------
async function renderProfile() {
  setTitle("Mi perfil");
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
    navigate("#/login");
  };
}

router();
