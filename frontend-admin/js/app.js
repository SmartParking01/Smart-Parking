const viewEl = document.getElementById("view");
const pageTitle = document.getElementById("page-title");
const whoAmI = document.getElementById("who-am-i");
const sidebar = document.getElementById("sidebar");
const sideNav = document.getElementById("side-nav");

let state = { user: null };

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
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
      <h1 style="margin-top:0;">🅿️ Smart Parking</h1>
      <p class="muted">Panel administrativo — Personal y administradores</p>
      <div class="input-group"><label>Correo electrónico</label><input id="l-email" type="email" /></div>
      <div class="input-group"><label>Contraseña</label><input id="l-password" type="password" /></div>
      <p class="error-text" id="l-error"></p>
      <button class="btn" id="l-submit" style="width:100%;">Iniciar sesión</button>
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
      if (!["ADMIN", "SECURITY"].includes(data.user.role)) {
        errEl.textContent = "Esta cuenta no tiene acceso al panel administrativo.";
        return;
      }
      Api.setToken(data.token);
      state.user = data.user;
      afterLogin();
    } catch (err) {
      errEl.textContent = err.message;
    }
  };
}

function afterLogin() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("shell").style.display = "flex";
  whoAmI.textContent = `${state.user.first_name} ${state.user.last_name} · ${state.user.role}`;
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
  window.location.hash = "";
  renderLoginScreen();
};

function currentEstablishmentId() {
  return state.user.establishmentId;
}

// ---------------------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------------------
async function renderDashboard() {
  const estId = currentEstablishmentId();
  if (!estId) {
    viewEl.innerHTML = `<div class="card"><p>Tu cuenta no tiene un establecimiento asignado.</p></div>`;
    return;
  }
  const { current, occupancyRatePercent } = await Api.get(`/stats/${estId}/summary`);
  const { entries } = await Api.get("/entries/open");

  viewEl.innerHTML = `
    <div class="grid-3">
      <div class="card"><div class="stat-label">Disponibles</div><div class="stat-value" style="color:var(--available)">${current.AVAILABLE}</div></div>
      <div class="card"><div class="stat-label">Reservados</div><div class="stat-label"></div><div class="stat-value" style="color:var(--reserved)">${current.RESERVED}</div></div>
      <div class="card"><div class="stat-label">Ocupados</div><div class="stat-value" style="color:var(--occupied)">${current.OCCUPIED}</div></div>
    </div>
    <div class="card">
      <div class="stat-label">Ocupación total</div>
      <div class="stat-value">${occupancyRatePercent}%</div>
      <p class="muted">${current.TOTAL} espacios en total · ${current.BLOCKED} bloqueados</p>
    </div>
    <div class="card">
      <h3 style="margin-top:0;">Vehículos actualmente dentro (${entries.length})</h3>
      ${entries.length === 0 ? '<p class="muted">No hay vehículos dentro en este momento.</p>' :
        `<table><thead><tr><th>Espacio</th><th>Conductor</th><th>Entrada</th><th>Origen</th></tr></thead><tbody>
          ${entries.map(e => `<tr>
            <td>${escapeHtml(e.space_code)}</td>
            <td>${escapeHtml(e.user_name || "Sin registrar (walk-in)")}</td>
            <td>${new Date(e.entry_time).toLocaleString()}</td>
            <td>${e.source === 'RESERVATION' ? 'Reserva' : 'Sin reserva'}</td>
          </tr>`).join("")}
        </tbody></table>`}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// ENTRADAS: escanear/pegar QR + asignación manual (walk-in)
// ---------------------------------------------------------------------------
async function renderEntries() {
  const estId = currentEstablishmentId();
  const { spaces } = await Api.get(`/spaces/establishment/${estId}`);
  const available = spaces.filter((s) => s.status === "AVAILABLE");

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
              available.map((s) => `<option value="${s.id}">${escapeHtml(s.code)} (${escapeHtml(s.row_label || "")})</option>`).join("")}
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
      okEl.textContent = `Ingreso autorizado: espacio ${data.space.code} para ${data.user ? data.user.name : "conductor"}.`;
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
        `<table><thead><tr><th>Espacio</th><th>Conductor</th><th>Hora de entrada</th><th></th></tr></thead><tbody>
          ${entries.map(e => `<tr>
            <td>${escapeHtml(e.space_code)}</td>
            <td>${escapeHtml(e.user_name || "Sin registrar (walk-in)")}</td>
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
  const estId = currentEstablishmentId();
  const { rows } = await Api.get(`/establishments/${estId}/map`);
  const isAdmin = state.user.role === "ADMIN";

  let html = `<div class="card">
    <div style="display:flex; gap:16px; font-size:12px; color:var(--muted); margin-bottom:10px;">
      <span><span class="badge AVAILABLE">&nbsp;</span> Disponible</span>
      <span><span class="badge RESERVED">&nbsp;</span> Reservado</span>
      <span><span class="badge OCCUPIED">&nbsp;</span> Ocupado</span>
      <span><span class="badge BLOCKED">&nbsp;</span> Bloqueado</span>
    </div>`;

  for (const [rowLabel, spaces] of Object.entries(rows)) {
    html += `<div class="row-label">${escapeHtml(rowLabel)}</div><div class="space-grid">`;
    for (const s of spaces) {
      html += `<div class="space-cell ${s.status}" title="${escapeHtml(s.code)} - ${s.status}"
        ${isAdmin ? `data-id="${s.id}" data-status="${s.status}" style="cursor:pointer;"` : ""}>${escapeHtml(s.code)}</div>`;
    }
    html += `</div>`;
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
  const estId = currentEstablishmentId();
  viewEl.innerHTML = `
    <div class="card">
      <div class="input-group" style="max-width:220px;">
        <label>Filtrar por estado</label>
        <select id="status-filter">
          <option value="">Todas</option>
          <option value="ACTIVE">Activas</option>
          <option value="USED">Usadas</option>
          <option value="CANCELLED">Canceladas</option>
          <option value="EXPIRED">Expiradas</option>
        </select>
      </div>
      <div id="res-table"></div>
    </div>
  `;

  async function load() {
    const status = document.getElementById("status-filter").value;
    const { reservations } = await Api.get(`/reservations/establishment/${estId}${status ? `?status=${status}` : ""}`);
    document.getElementById("res-table").innerHTML = reservations.length === 0
      ? '<p class="muted">No hay reservas para este filtro.</p>'
      : `<table><thead><tr><th>Conductor</th><th>Espacio</th><th>Creada</th><th>Vence</th><th>Estado</th></tr></thead><tbody>
          ${reservations.map(r => `<tr>
            <td>${escapeHtml(r.user_name)}</td>
            <td>${escapeHtml(r.space_code)}</td>
            <td>${new Date(r.created_at).toLocaleString()}</td>
            <td>${new Date(r.expires_at).toLocaleString()}</td>
            <td><span class="badge ${r.status}">${r.status}</span></td>
          </tr>`).join("")}
        </tbody></table>`;
  }
  document.getElementById("status-filter").onchange = load;
  load();
}

// ---------------------------------------------------------------------------
// GESTIÓN DE ESPACIOS (solo ADMIN)
// ---------------------------------------------------------------------------
async function renderSpaces() {
  const estId = currentEstablishmentId();
  const { spaces } = await Api.get(`/spaces/establishment/${estId}`);

  viewEl.innerHTML = `
    <div class="card">
      <h3 style="margin-top:0;">Crear espacio</h3>
      <div class="grid-2">
        <div class="input-group"><label>Código (ej: A01)</label><input id="sp-code" /></div>
        <div class="input-group"><label>Fila / etiqueta</label><input id="sp-row" placeholder="Fila A" /></div>
      </div>
      <p class="error-text" id="sp-error"></p>
      <button class="btn" id="sp-submit">Agregar espacio</button>
    </div>
    <div class="card">
      <h3 style="margin-top:0;">Espacios existentes (${spaces.length})</h3>
      <table><thead><tr><th>Código</th><th>Fila</th><th>Estado</th><th></th></tr></thead><tbody>
        ${spaces.map(s => `<tr>
          <td>${escapeHtml(s.code)}</td>
          <td>${escapeHtml(s.row_label || "-")}</td>
          <td><span class="badge ${s.status}">${s.status}</span></td>
          <td>
            <button class="btn secondary block-btn" data-id="${s.id}" data-status="${s.status}">${s.status === "BLOCKED" ? "Desbloquear" : "Bloquear"}</button>
            <button class="btn danger del-btn" data-id="${s.id}">Eliminar</button>
          </td>
        </tr>`).join("")}
      </tbody></table>
    </div>
  `;

  document.getElementById("sp-submit").onclick = async () => {
    const errEl = document.getElementById("sp-error");
    errEl.textContent = "";
    try {
      await Api.post("/spaces", {
        establishmentId: estId,
        code: document.getElementById("sp-code").value.trim().toUpperCase(),
        rowLabel: document.getElementById("sp-row").value.trim(),
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
// ESTABLECIMIENTOS (solo ADMIN)
// ---------------------------------------------------------------------------
async function renderEstablishments() {
  const { establishments } = await Api.get("/establishments");

  viewEl.innerHTML = `
    <div class="card">
      <h3 style="margin-top:0;">Crear establecimiento</h3>
      <div class="grid-2">
        <div class="input-group"><label>Nombre</label><input id="e-name" /></div>
        <div class="input-group">
          <label>Tipo</label>
          <select id="e-type">
            <option value="MALL">Centro comercial</option>
            <option value="HOSPITAL">Hospital privado</option>
            <option value="RESIDENTIAL">Residencial / condominio</option>
            <option value="HOTEL">Hotel</option>
            <option value="UNIVERSITY">Universidad privada</option>
            <option value="COMPANY">Empresa</option>
            <option value="OTHER">Otro</option>
          </select>
        </div>
      </div>
      <div class="input-group"><label>Dirección</label><input id="e-address" /></div>
      <div class="input-group"><label>Reglas del parqueo</label><textarea id="e-rules" rows="2"></textarea></div>
      <p class="error-text" id="e-error"></p>
      <button class="btn" id="e-submit">Crear establecimiento</button>
    </div>
    <div class="card">
      <h3 style="margin-top:0;">Establecimientos existentes</h3>
      <table><thead><tr><th>Nombre</th><th>Tipo</th><th>Espacios</th></tr></thead><tbody>
        ${establishments.map(e => `<tr>
          <td>${escapeHtml(e.name)}</td>
          <td>${escapeHtml(e.type)}</td>
          <td>${e.availability.TOTAL}</td>
        </tr>`).join("")}
      </tbody></table>
    </div>
  `;

  document.getElementById("e-submit").onclick = async () => {
    const errEl = document.getElementById("e-error");
    errEl.textContent = "";
    try {
      await Api.post("/establishments", {
        name: document.getElementById("e-name").value.trim(),
        type: document.getElementById("e-type").value,
        address: document.getElementById("e-address").value.trim(),
        rules: document.getElementById("e-rules").value.trim(),
      });
      renderEstablishments();
    } catch (err) {
      errEl.textContent = err.message;
    }
  };
}

// ---------------------------------------------------------------------------
// PERSONAL (solo ADMIN) - crear cuentas SECURITY/ADMIN
// ---------------------------------------------------------------------------
async function renderStaff() {
  const estId = currentEstablishmentId();
  const { users } = await Api.get(`/users/staff/${estId}`);

  viewEl.innerHTML = `
    <div class="card">
      <h3 style="margin-top:0;">Registrar personal</h3>
      <div class="grid-2">
        <div class="input-group"><label>Nombre</label><input id="st-name" /></div>
        <div class="input-group"><label>Correo</label><input id="st-email" type="email" /></div>
        <div class="input-group"><label>Teléfono</label><input id="st-phone" /></div>
        <div class="input-group">
          <label>Rol</label>
          <select id="st-role"><option value="SECURITY">Guarda de seguridad</option><option value="ADMIN">Administrador</option></select>
        </div>
      </div>
      <div class="input-group"><label>Contraseña temporal</label><input id="st-password" type="password" /></div>
      <p class="error-text" id="st-error"></p>
      <button class="btn" id="st-submit">Crear cuenta</button>
    </div>
    <div class="card">
      <h3 style="margin-top:0;">Personal registrado</h3>
      <table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th></tr></thead><tbody>
        ${users.map(u => `<tr><td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.email)}</td><td><span class="badge OCCUPIED" style="background:var(--primary)">${u.role}</span></td></tr>`).join("")}
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
        establishmentId: estId,
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
  const estId = currentEstablishmentId();
  const { current, occupancyRatePercent } = await Api.get(`/stats/${estId}/summary`);
  const { prediction, weekdayHistory } = await Api.get(`/stats/${estId}/prediction`);

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
