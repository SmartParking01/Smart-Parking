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
  "#/payment": renderPayment,
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
    html += `<div class="card empty-state"><p>Este establecimiento todavía no tiene espacios configurados.</p></div>`;
    view.innerHTML = html;
    return;
  }

  // Vista de parqueo en pseudo-3D (solo visual) — usa los mismos espacios
  // que la cuadrícula de abajo, agrupados por fila/zona.
  const flatSpaces = [];
  for (const parkingName of parkingNames) {
    for (const [rowLabel, spaces] of Object.entries(parkings[parkingName])) {
      spaces.forEach((s) => flatSpaces.push({ ...s, row_location: rowLabel }));
    }
  }
  html += renderParking3DBlock(flatSpaces, establishment.name);

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
  document.getElementById("confirm-btn").onclick = () => navigate("#/payment");
}

// ---------------------------------------------------------------------------
// PAGO POR ADELANTADO (DEMOSTRACIÓN)
// ---------------------------------------------------------------------------
// Este formulario es una SIMULACIÓN para el proyecto académico: valida el
// formato de los datos de la tarjeta y "aprueba" el pago en el navegador,
// pero no se conecta con ningún banco ni procesador de pagos real, y el
// número completo de la tarjeta nunca se envía al backend ni se guarda en
// ninguna base de datos. Para un pago real habría que integrar un
// procesador con cuenta de comercio (Stripe, Onvopay, etc.).
function luhnCheck(num) {
  const digits = num.replace(/\D/g, "").split("").reverse().map(Number);
  let sum = 0;
  digits.forEach((d, i) => {
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  });
  return digits.length >= 13 && sum % 10 === 0;
}

async function renderPayment() {
  setTitle("Pago del espacio");
  if (!state.selectedSpaceId) return navigate("#/establishment");

  view.innerHTML = `
    <div class="card">
      <h2>Pago por adelantado</h2>
      <p class="muted">Formulario de demostración — no se procesa un cobro real ni se guarda el número completo de la tarjeta.</p>
      <div class="input-group"><label>Nombre en la tarjeta</label><input id="pay-name" type="text" placeholder="Como aparece en la tarjeta" /></div>
      <div class="input-group"><label>Número de tarjeta</label><input id="pay-number" type="text" inputmode="numeric" maxlength="19" placeholder="0000 0000 0000 0000" /></div>
      <div style="display:flex;gap:12px;">
        <div class="input-group" style="flex:1;"><label>Vencimiento (MM/AA)</label><input id="pay-exp" type="text" maxlength="5" placeholder="MM/AA" /></div>
        <div class="input-group" style="flex:1;"><label>CVV</label><input id="pay-cvv" type="text" inputmode="numeric" maxlength="4" placeholder="123" /></div>
      </div>
      <p class="error-text" id="pay-error"></p>
      <p class="success-text" id="pay-success"></p>
      <button class="btn" id="pay-submit">Pagar y confirmar reserva</button>
      <button class="btn secondary" id="pay-cancel" style="margin-top:10px;">Cancelar</button>
    </div>
  `;

  // Formatea el número en grupos de 4 mientras se escribe.
  document.getElementById("pay-number").oninput = (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
  };
  document.getElementById("pay-exp").oninput = (e) => {
    let v = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
    e.target.value = v;
  };

  document.getElementById("pay-cancel").onclick = () => navigate("#/reserve");

  document.getElementById("pay-submit").onclick = async () => {
    const errEl = document.getElementById("pay-error");
    const okEl = document.getElementById("pay-success");
    errEl.textContent = ""; okEl.textContent = "";

    const name = document.getElementById("pay-name").value.trim();
    const number = document.getElementById("pay-number").value.replace(/\s/g, "");
    const exp = document.getElementById("pay-exp").value.trim();
    const cvv = document.getElementById("pay-cvv").value.trim();

    if (!name) { errEl.textContent = "Escribe el nombre tal como aparece en la tarjeta."; return; }
    if (!/^\d{13,16}$/.test(number) || !luhnCheck(number)) { errEl.textContent = "El número de tarjeta no es válido."; return; }
    const expMatch = exp.match(/^(\d{2})\/(\d{2})$/);
    if (!expMatch) { errEl.textContent = "Formato de vencimiento inválido. Usa MM/AA."; return; }
    const [, mm, yy] = expMatch;
    const now = new Date();
    const expDate = new Date(2000 + Number(yy), Number(mm), 0);
    if (Number(mm) < 1 || Number(mm) > 12 || expDate < now) { errEl.textContent = "La tarjeta está vencida o el mes no es válido."; return; }
    if (!/^\d{3,4}$/.test(cvv)) { errEl.textContent = "El CVV no es válido."; return; }

    const submitBtn = document.getElementById("pay-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Procesando pago...";

    // Simulación: una pequeña espera para que se sienta como un cobro real.
    await new Promise((r) => setTimeout(r, 900));
    okEl.textContent = "Pago aprobado. Confirmando tu reserva...";

    try {
      const data = await Api.post("/reservations", { spaceId: state.selectedSpaceId });
      state.lastReservationId = data.reservation.id;
      state.lastQrImage = data.qr.image;
      state.lastQrReservation = data.reservation;
      state.viewReservationId = null;
      navigate("#/qr");
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Pagar y confirmar reserva";
      okEl.textContent = "";
      errEl.textContent = err.message;
    }
  };
}

async function renderQr() {
  setTitle("Tu código QR");

  // Si venimos del Historial (viendo una reserva pasada/vigente), pedimos
  // el QR de nuevo al backend en vez de depender de la memoria del
  // navegador — así sigue disponible aunque se haya cerrado la app.
  if (state.viewReservationId) {
    try {
      const data = await Api.get(`/reservations/${state.viewReservationId}/qr`);
      state.lastQrImage = data.qr.image;
      state.lastQrReservation = data.reservation;
    } catch (err) {
      view.innerHTML = `<div class="card center"><p class="error-text">${escapeHtml(err.message)}</p></div>`;
      return;
    }
  }

  if (!state.lastQrImage) return navigate("#/home");
  const r = state.lastQrReservation;
  view.innerHTML = `
    <div class="card center">
      <h2>¡Reserva confirmada!</h2>
      <p>Muestra este código al guarda de seguridad al ingresar.</p>
      ${r ? `<p><strong>${escapeHtml(r.parking_name || "")}</strong> · Espacio ${escapeHtml(r.space_code || "")}</p>` : ""}
      <img class="qr-image" src="${state.lastQrImage}" alt="Código QR de la reserva" />
      <button class="btn" id="go-home-btn">Ir al inicio</button>
    </div>
  `;
  document.getElementById("go-home-btn").onclick = () => { state.viewReservationId = null; navigate("#/home"); };
}

// ---------------------------------------------------------------------------
// HISTORIAL - reservas pasadas
// ---------------------------------------------------------------------------
async function renderHistory() {
  setTitle("Historial");
  showLoading();
  const { reservations } = await Api.get("/reservations/mine");

  if (reservations.length === 0) {
    view.innerHTML = `<div class="card empty-state"><p>Todavía no tienes reservas.</p></div>`;
    return;
  }

  // Solo tiene sentido volver a mostrar el QR mientras la reserva sigue
  // vigente (todavía no se usó, canceló o venció).
  const QR_VISIBLE_STATUSES = ["CONFIRMED", "PENDING", "ACTIVE"];

  view.innerHTML = `<div class="card">` +
    reservations
      .map(
        (r) => `
      <div class="list-item">
        <div>
          <strong>${escapeHtml(r.parking_name)}</strong>
          <p style="margin:2px 0;">Espacio ${escapeHtml(r.space_code)} · ${new Date(r.created_at).toLocaleString()}</p>
        </div>
        <div style="text-align:right;">
          <span class="badge ${r.status}">${r.status}</span>
          ${QR_VISIBLE_STATUSES.includes(r.status) ? `<button class="link-btn" data-view-qr="${r.id}" style="display:block;margin-top:4px;">Ver código QR</button>` : ""}
        </div>
      </div>`
      )
      .join("") +
    `</div>`;

  view.querySelectorAll("[data-view-qr]").forEach((btn) => {
    btn.onclick = () => {
      state.viewReservationId = btn.dataset.viewQr;
      navigate("#/qr");
    };
  });
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
