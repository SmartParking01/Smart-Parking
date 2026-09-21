// =============================================================================
// theme.js — Solo decoración visual. NO toca la lógica de app.js.
// Se ejecuta ANTES de app.js (por el orden en index.html).
// =============================================================================
(function () {
  // 1) Reemplazar el texto del brand por el bloque SMART / PARKING
  const brand = document.querySelector(".brand");
  if (brand) {
    const nameEl = brand.querySelector(".brand-name");
    if (nameEl) nameEl.remove();
    const subEl = brand.querySelector(".brand-sub");
    if (subEl) {
      subEl.classList.add("brand-text");
      subEl.innerHTML = "SMART<small>PARKING</small>";
    }
  }

  // 2) Agregar íconos SVG a los botones del sidebar (sin romper el texto)
  const ICONS = {
    "#/dashboard": '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    "#/entries": '<path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
    "#/exits": '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
    "#/parking": '<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2"/>',
    "#/reservations": '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    "#/spaces": '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    "#/establishments": '<path d="M3 21h18M5 21V7l7-5 7 5v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01"/>',
    "#/staff": '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    "#/stats": '<path d="M3 21h18M7 17v-6M12 17V7M17 17v-4"/>'
  };
  document.querySelectorAll("#side-nav .side-btn").forEach((btn) => {
    const route = btn.getAttribute("data-route");
    const svg = ICONS[route];
    if (!svg) return;
    // limpiar emoji del texto original si existe
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${svg}</svg><span>${btn.textContent.trim()}</span>`;
  });

  // Logout con ícono
  const logout = document.getElementById("logout-btn");
  if (logout) {
    logout.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg><span>Cerrar sesión</span>`;
  }

  // 3) Pie del sidebar con usuario (se llena en theme una vez con datos de /auth/me vía app.js)
  const sidebar = document.getElementById("sidebar");
  if (sidebar && !document.querySelector(".side-foot")) {
    const foot = document.createElement("div");
    foot.className = "side-foot";
    foot.innerHTML = `
      <div class="side-user">
        <div class="side-user-icon" id="theme-user-initial">A</div>
        <div>
          <strong id="theme-user-name">Administrador</strong>
          <span id="theme-user-role">Cargando…</span>
        </div>
      </div>`;
    sidebar.appendChild(foot);
  }

  // 4) Topbar: campanita + chip de usuario (junto al #who-am-i existente)
  const topbar = document.getElementById("topbar");
  if (topbar && !document.querySelector(".topbar-right")) {
    const right = document.createElement("div");
    right.className = "topbar-right";
    right.innerHTML = `
      <div class="icon-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>
      </div>
      <div class="user-chip">
        <div class="user-chip-avatar" id="theme-chip-initial">A</div>
        <span id="theme-chip-name">Administrador</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </div>`;
    topbar.appendChild(right);
  }

  // 5) Cuando app.js cargue el usuario, rellenamos los textos con un observer simple
  const fill = (name, role) => {
    const initial = (name || "A").charAt(0).toUpperCase();
    ["theme-user-initial","theme-chip-initial"].forEach(id=>{
      const el = document.getElementById(id); if (el) el.textContent = initial;
    });
    ["theme-user-name","theme-chip-name"].forEach(id=>{
      const el = document.getElementById(id); if (el) el.textContent = name;
    });
    const roleEl = document.getElementById("theme-user-role");
    if (roleEl) roleEl.textContent = role;
  };

  // app.js pone el contenido de #who-am-i al autenticar. Observamos ese nodo.
  const who = document.getElementById("who-am-i");
  if (who) {
    const mo = new MutationObserver(() => {
      const txt = who.textContent.trim();
      // formato típico: "Nombre Apellido, Administración"
      const [namePart, rolePart] = txt.split(",").map(s=>s.trim());
      fill(namePart || "Administrador", rolePart || "");
    });
    mo.observe(who, { childList: true, characterData: true, subtree: true });
  }
})();