// =============================================================================
// Smart Parking · App Conductor (Dark Premium) — Autocontenido
// =============================================================================

const view        = document.getElementById("app-view");
const headerTitle = document.getElementById("header-title");
const backBtn     = document.getElementById("btn-back");
const bottomNav   = document.getElementById("bottom-nav");

let state = {
  user: null,
  establishments: [],
  currentEstablishmentId: null,
  currentSpaces: [],
  selectedSpaceId: null,
  selectedParkingName: null,
  geoMap: null,
  lastReservationId: null,
  lastQrImage: null,
};

// ---------------------------------------------------------------------------
// Router
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
  "#/history":       renderHistory,
  "#/profile":       renderProfile,
};

const AUTH_FREE_ROUTES = ["#/login", "#/register", "#/forgot"];

function navigate(route) { window.location.hash = route; }

async function router() {
  let route = window.location.hash || "#/login";
  const [base] = route.split("?");

  const token = Api.getToken();

  if (!token && !AUTH_FREE_ROUTES.includes(base)) {
    return navigate("#/login");
  }
  if (token && AUTH_FREE_ROUTES.includes(base)) {
    return navigate("#/home");
  }

  const isTopLevel = ["#/home", "#/map", "#/history", "#/profile"].includes(base);
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
function setTitle(t) { headerTitle.textContent = t; }
function showLoading() { view.innerHTML = `<div class="spinner"></div>`; }

// ---------------------------------------------------------------------------
// LOGIN / REGISTRO / FORGOT
// ---------------------------------------------------------------------------
function renderLogin() {
  setTitle("Smart Parking");
  view.innerHTML = `
    <div class="auth-wrap">
      <img src="assets/logo.png" alt="Smart Parking" class="auth-logo"
           onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
      <div class="auth-logo-fb">P</div>
      <h2 class="auth-title">Inicia sesión</h2>
      <p class="auth-sub">Gestiona y controla tu parqueo de forma fácil y segura.</p>

      <div class="input-group">
        <label>Correo electrónico</label>
        <input type="email" id="login-email" placeholder="correo@ejemplo.com" autocomplete="email" />
      </div>
      <div class="input-group">
        <label>Contraseña</label>
        <input type="password" id="login-password" placeholder="••••••••" autocomplete="current-password" />
      </div>
      <p class="error-text" id="login-error"></p>
      <button class="btn" id="login-submit">Iniciar sesión</button>
      <button class="link-btn" id="go-forgot" style="width:100%;margin-top:14px">¿Olvidaste tu contraseña?</button>
      <button class="link-btn" id="go-register" style="width:100%">Crear una cuenta nueva</button>
    </div>
  `;

  document.getElementById("go-register").onclick = () => navigate("#/register");
  document.getElementById("go-forgot").onclick   = () => navigate("#/forgot");

  document.getElementById("login-submit").onclick = async () => {
    const email    = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const errEl    = document.getElementById("login-error");
    errEl.textContent = "";

    if (!email || !password) {
      errEl.textContent = "Ingresa tu correo y contraseña.";
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        throw new Error(data.message || "No se pudo iniciar sesión.");
      }

      const role  = data.user?.role;
      const token = data.token;
      if (!role || !token) throw new Error("Respuesta inválida del servidor.");

      localStorage.removeItem("sp_token");
      localStorage.removeItem("sp_admin_token");

      if (role === "USER") {
        localStorage.setItem("sp_token", token);
        state.user = data.user;
        navigate("#/home");
      } else if (role === "ADMIN" || role === "ATTENDANT") {
        localStorage.setItem("sp_admin_token", token);
        window.location.href = "../frontend-admin/index.html#/dashboard";
      } else {
        throw new Error("Tu cuenta no tiene un rol válido.");
      }
    } catch (err) {
      errEl.textContent = err.message;
    }
  };
}

function renderRegister() {
  setTitle("Crear cuenta");
  view.innerHTML = `
    <div class="auth-wrap">
      <h2 class="auth-title">Crear cuenta</h2>
      <p class="auth-sub">Únete y reserva tu espacio en segundos.</p>

      <div class="input-group"><label>Nombre completo</label><input id="r-name" /></div>
      <div class="input-group"><label>Correo electrónico</label><input id="r-email" type="email" /></div>
      <div class="input-group"><label>Teléfono</label><input id="r-phone" /></div>
      <div class="input-group"><label>Contraseña</label><input id="r-password" type="password" /></div>
      <p class="error-text" id="r-error"></p>
      <button class="btn" id="r-submit">Registrarme</button>
      <button class="link-btn" id="r-goLogin" style="width:100%;margin-top:14px">Ya tengo cuenta</button>
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
    <div class="auth-wrap">
      <h2 class="auth-title">Recuperar contraseña</h2>
      <p class="auth-sub">Ingresa tu correo y te generaremos un enlace.</p>

      <div class="input-group"><label>Correo electrónico</label><input id="f-email" type="email" /></div>
      <p class="success-text" id="f-msg"></p>
      <button class="btn" id="f-submit">Enviar</button>
      <button class="link-btn" id="f-goLogin" style="width:100%;margin-top:14px">Volver a iniciar sesión</button>
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

const PLACEHOLDER_IMGS = [
  "https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?auto=format&fit=crop&w=600&q=70",
  "https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=600&q=70",
  "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=600&q=70",
  "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=600&q=70",
];
function pickImg(i) { return PLACEHOLDER_IMGS[i % PLACEHOLDER_IMGS.length]; }

async function renderHome() {
  setTitle("Parqueos disponibles");
  showLoading();
  const { establishments } = await Api.get("/establishments");
  state.establishments = establishments;

  if (establishments.length === 0) {
    view.innerHTML = `<div class="card empty-state"><span class="mark">Sin establecimientos</span><p>No hay establecimientos registrados todavía.</p></div>`;
    return;
  }

  view.innerHTML = `
    <div class="card hero">
      <h2>¡Hola! 👋</h2>
      <p>¿A dónde vamos hoy? Encuentra tu parqueo ideal.</p>
    </div>

    <div class="m-search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
      <input placeholder="Buscar parqueos, centros comerciales..." />
    </div>

    <div class="m-actions">
      <div class="m-action a-blue" id="go-map">
        <div class="m-action-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s-8-8-8-13a8 8 0 1116 0c0 5-8 13-8 13z"/><circle cx="12" cy="9" r="2.5"/></svg></div>
        <span>Mapa</span>
      </div>
      <div class="m-action a-green">
        <div class="m-action-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></div>
        <span>Reservar</span>
      </div>
      <div class="m-action a-yellow" id="go-history">
        <div class="m-action-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg></div>
        <span>Mis reservas</span>
      </div>
    </div>

    <div class="m-section-head">
      <h3>Parqueos cercanos</h3>
      <a id="go-all">Ver todos</a>
    </div>

    <div id="est-list"></div>
  `;

  document.getElementById("go-map").onclick     = () => navigate("#/map");
  document.getElementById("go-history").onclick = () => navigate("#/history");
  document.getElementById("go-all").onclick     = () => navigate("#/map");

  const listEl = document.getElementById("est-list");
  listEl.innerHTML = establishments.map((e, i) => {
    const level = availabilityLevel(e.availability);
    const available = e.availability?.AVAILABLE ?? 0;
    return `
      <div class="m-parking" data-id="${e.id}">
        <div class="m-parking-img" style="background-image:url('${pickImg(i)}')"></div>
        <div class="m-parking-body">
          <h4>${escapeHtml(e.name)}</h4>
          <div class="meta">
            <span>${escapeHtml(e.address || "Sin dirección")}</span>
            <span class="price">₡500/h</span>
          </div>
          <span class="m-avail ${level}">● ${available} disponibles</span>
        </div>
      </div>`;
  }).join("");

  listEl.querySelectorAll(".m-parking").forEach(item => {
    item.onclick = () => {
      state.currentEstablishmentId = item.dataset.id;
      navigate("#/establishment");
    };
  });
}

// ---------------------------------------------------------------------------
// MAPA
// ---------------------------------------------------------------------------
async function renderMap() {
  setTitle("Parqueos cercanos");
  showLoading();

  const { establishments } = state.establishments.length
    ? { establishments: state.establishments }
    : await Api.get("/establishments");
  state.establishments = establishments;
  const withCoords = establishments.filter(e => e.latitude != null && e.longitude != null);

  view.innerHTML = `
    <div class="m-search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
      <input placeholder="Buscar en esta zona" />
    </div>
    <div id="mini-map"></div>
    <div id="map-list"></div>
  `;

  const listEl = document.getElementById("map-list");
  listEl.innerHTML = establishments.map((e) => {
    const level = availabilityLevel(e.availability);
    const available = e.availability?.AVAILABLE ?? 0;
    return `
      <div class="m-parking" data-id="${e.id}">
        <div class="m-parking-body">
          <h4>${escapeHtml(e.name)}</h4>
          <div class="meta">
            <span>${escapeHtml(e.address || "")}</span>
            <span class="price">₡500/h</span>
          </div>
          <span class="m-avail ${level}">● ${available} disponibles</span>
        </div>
      </div>`;
  }).join("");

  listEl.querySelectorAll(".m-parking").forEach(item => {
    item.onclick = () => {
      state.currentEstablishmentId = item.dataset.id;
      navigate("#/establishment");
    };
  });

  if (withCoords.length > 0) {
    const mapEl = document.getElementById("mini-map");
    const map = L.map(mapEl, { zoomControl: false, attributionControl: false }).setView(
      [withCoords[0].latitude, withCoords[0].longitude], 13
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

    const pin = (letter) => L.divIcon({
      className: "",
      html: `<div class="map-pin-icon"><span>${escapeHtml((letter || "P").charAt(0).toUpperCase())}</span></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 26],
    });

    withCoords.forEach(e => {
      L.marker([e.latitude, e.longitude], { icon: pin(e.name) }).addTo(map)
        .bindPopup(`<strong>${escapeHtml(e.name)}</strong><br>${e.availability?.AVAILABLE ?? 0} de ${e.availability?.TOTAL ?? 0} libres`);
    });

    if (withCoords.length > 1) {
      const group = L.featureGroup(withCoords.map(e => L.marker([e.latitude, e.longitude])));
      map.fitBounds(group.getBounds().pad(0.25));
    }
  }
}

// ---------------------------------------------------------------------------
// ESTABLECIMIENTO (grid de espacios)
// ---------------------------------------------------------------------------
async function renderEstablishment() {
  setTitle("Mapa del parqueo");
  showLoading();
  const id = state.currentEstablishmentId;
  if (!id) return navigate("#/home");

  const { parkings, establishment } = await Api.get(`/establishments/${id}/map`);
  state.selectedSpaceId = null;
  state.selectedParkingName = null;

  let html = `
    <div class="card">
      <h3>${escapeHtml(establishment.name)}</h3>
      <p class="muted" style="margin:0 0 10px">Selecciona un espacio disponible para reservarlo.</p>
      <div class="legend-row">
        <span><span class="dot AVAILABLE"></span>Libre</span>
        <span><span class="dot RESERVED"></span>Reservado</span>
        <span><span class="dot OCCUPIED"></span>Ocupado</span>
        <span><span class="dot BLOCKED"></span>Bloqueado</span>
      </div>
    </div>
  `;

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
        html += `<div class="space-cell ${s.status}" data-id="${s.id}" data-status="${s.status}" data-parking="${escapeHtml(parkingName)}">${escapeHtml(s.code)}</div>`;
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
      state.selectedParkingName = cell.dataset.parking;
      document.getElementById("reserve-btn").disabled = false;
    };
  });

  document.getElementById("reserve-btn").onclick = () => navigate("#/reserve");
}

// ---------------------------------------------------------------------------
// CONFIRMAR RESERVA
// ---------------------------------------------------------------------------
async function renderReserveConfirm() {
  setTitle("Confirmar reserva");
  if (!state.selectedSpaceId) return navigate("#/home");

  view.innerHTML = `
    <div class="card center">
      <h2>Confirmar reserva</h2>
      <p>Se generará un código QR único que deberás mostrar al ingresar. La reserva vence si no la usas a tiempo.</p>
      <p class="muted" style="margin-top:14px">Espacio: <strong style="color:var(--yellow)">${escapeHtml(state.selectedParkingName || "")}</strong></p>
      <p class="error-text" id="reserve-error"></p>
      <button class="btn yellow" id="confirm-btn" style="margin-top:16px">Confirmar reserva</button>
      <button class="btn secondary" id="cancel-btn" style="margin-top:10px">Cancelar</button>
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
    } catch (err) { errEl.textContent = err.message; }
  };
}

// ---------------------------------------------------------------------------
// QR
// ---------------------------------------------------------------------------
async function renderQr() {
  setTitle("Tu código QR");
  if (!state.lastQrImage) return navigate("#/home");
  view.innerHTML = `
    <div class="card center">
      <h2>¡Reserva confirmada!</h2>
      <p>Muestra este código al guarda de seguridad al ingresar.</p>
      <img class="qr-image" src="${state.lastQrImage}" alt="Código QR de la reserva" />
      <button class="btn" id="go-home-btn" style="margin-top:14px">Ir al inicio</button>
    </div>
  `;
  document.getElementById("go-home-btn").onclick = () => navigate("#/home");
}

// ---------------------------------------------------------------------------
// HISTORIAL
// ---------------------------------------------------------------------------
async function renderHistory() {
  setTitle("Mis reservas");
  showLoading();
  const { reservations } = await Api.get("/reservations/mine");

  if (reservations.length === 0) {
    view.innerHTML = `<div class="card empty-state"><span class="mark">Sin reservas</span><p>Todavía no tienes reservas.</p></div>`;
    return;
  }

  view.innerHTML = `<div class="card">` +
    reservations.map(r => `
      <div class="list-item">
        <div>
          <strong>${escapeHtml(r.parking_name)}</strong>
          <p style="margin:2px 0;font-size:12.5px">Espacio ${escapeHtml(r.space_code)} · ${new Date(r.created_at).toLocaleString()}</p>
        </div>
        <span class="badge ${r.status}">${r.status}</span>
      </div>
    `).join("") +
    `</div>`;
}

// ---------------------------------------------------------------------------
// PERFIL
// ---------------------------------------------------------------------------
async function renderProfile() {
  setTitle("Mi perfil");
  const { user } = await Api.get("/auth/me");
  state.user = user;
  const full = fullName(user) || user.email;
  const initial = (full[0] || "U").toUpperCase();

  view.innerHTML = `
    <div class="card center" style="padding-top:32px">
      <div style="width:78px;height:78px;border-radius:50%;background:linear-gradient(135deg,#38BDF8,#3B82F6);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:32px;font-weight:800;color:#fff;margin:0 auto 14px;box-shadow:0 8px 24px rgba(79,140,255,.35)">${initial}</div>
      <h2 style="margin-bottom:4px">${escapeHtml(full)}</h2>
      <p class="muted" style="margin:0">${escapeHtml(user.email)}</p>
      <p class="muted" style="margin:6px 0 0">${escapeHtml(user.phone || "Sin teléfono registrado")}</p>
    </div>

    <div class="card">
      <h3>Cuenta</h3>
      <div class="list-item"><span class="muted">Rol</span><strong>Conductor</strong></div>
      <div class="list-item"><span class="muted">Estado</span><span class="badge AVAILABLE">Activo</span></div>
    </div>

    <button class="btn danger" id="logout-btn">Cerrar sesión</button>
  `;

  document.getElementById("logout-btn").onclick = () => {
    Api.clearToken();
    state.user = null;
    navigate("#/login");
  };
}

// Arranca
router();