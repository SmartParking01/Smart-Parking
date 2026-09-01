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
  div.textContent = str;
  return div.innerHTML;
}

function setTitle(title) {
  headerTitle.textContent = title;
}

// ---------------------------------------------------------------------------
// LOGIN
// ---------------------------------------------------------------------------
function renderLogin() {
  setTitle("Smart Parking");
  view.innerHTML = `
    <div class="card center" style="margin-top:30px;">
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
// HOME - lista de establecimientos con disponibilidad
// ---------------------------------------------------------------------------
async function renderHome() {
  setTitle("Parqueos disponibles");
  view.innerHTML = `<p class="center">Cargando establecimientos...</p>`;
  const { establishments } = await Api.get("/establishments");
  state.establishments = establishments;

  if (establishments.length === 0) {
    view.innerHTML = `<div class="card"><p>No hay establecimientos registrados todavía.</p></div>`;
    return;
  }

  view.innerHTML = establishments
    .map(
      (e) => `
      <div class="card" data-id="${e.id}">
        <h2>${escapeHtml(e.name)}</h2>
        <p>${escapeHtml(e.address || "Dirección no especificada")}</p>
        <p><strong>${e.availability.AVAILABLE}</strong> de ${e.availability.TOTAL} espacios disponibles</p>
        <button class="btn view-btn">Ver espacios</button>
      </div>`
    )
    .join("");

  view.querySelectorAll(".card").forEach((card) => {
    card.querySelector(".view-btn").onclick = () => {
      state.currentEstablishmentId = card.dataset.id;
      navigate("#/establishment");
    };
  });
}

// ---------------------------------------------------------------------------
// ESTABLECIMIENTO - mapa visual de espacios
// ---------------------------------------------------------------------------
async function renderEstablishment() {
  setTitle("Mapa del parqueo");
  view.innerHTML = `<p class="center">Cargando espacios...</p>`;
  const id = state.currentEstablishmentId;
  const { rows, establishment } = await Api.get(`/establishments/${id}/map`);
  state.selectedSpaceId = null;

  let html = `<div class="card"><h2>${escapeHtml(establishment.name)}</h2>
    <p>Selecciona un espacio disponible para reservarlo.</p>
    <div style="display:flex; gap:14px; font-size:11px; color:var(--muted); margin-top:6px;">
      <span><span class="badge AVAILABLE">&nbsp;</span> Libre</span>
      <span><span class="badge RESERVED">&nbsp;</span> Reservado</span>
      <span><span class="badge OCCUPIED">&nbsp;</span> Ocupado</span>
      <span><span class="badge BLOCKED">&nbsp;</span> Bloqueado</span>
    </div>
  </div>`;

  html += `<div class="card">`;
  for (const [rowLabel, spaces] of Object.entries(rows)) {
    html += `<div class="row-label">${escapeHtml(rowLabel)}</div><div class="space-grid">`;
    for (const s of spaces) {
      html += `<div class="space-cell ${s.status}" data-id="${s.id}" data-status="${s.status}">${escapeHtml(s.code)}</div>`;
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
      const data = await Api.post("/reservations", {
        establishmentId: state.currentEstablishmentId,
        spaceId: state.selectedSpaceId,
      });
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
// HISTORIAL - reservas y entradas pasadas
// ---------------------------------------------------------------------------
async function renderHistory() {
  setTitle("Historial");
  view.innerHTML = `<p class="center">Cargando historial...</p>`;
  const { reservations } = await Api.get("/reservations/mine");

  if (reservations.length === 0) {
    view.innerHTML = `<div class="card"><p>Todavía no tienes reservas.</p></div>`;
    return;
  }

  view.innerHTML = `<div class="card">` +
    reservations
      .map(
        (r) => `
      <div class="list-item">
        <div>
          <strong>${escapeHtml(r.establishment_name)}</strong>
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
  view.innerHTML = `
    <div class="card">
      <h2>${escapeHtml(user.name)}</h2>
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
