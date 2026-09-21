// =============================================================================
// theme.js — Solo decoración visual. NO toca la lógica de app.js.
// =============================================================================
(function () {
  function applyTheme() {
    // 1) Reemplazar el texto del brand por el bloque SMART / PARKING
    const brand = document.querySelector(".brand");
    if (brand) {
      const nameEl = brand.querySelector(".brand-name");
      if (nameEl) nameEl.remove();

      let subEl = brand.querySelector(".brand-sub");
      if (!subEl) {
        subEl = document.createElement("span");
        subEl.className = "brand-sub";
        brand.appendChild(subEl);
      }
      subEl.classList.add("brand-text");
      subEl.innerHTML = "SMART<small>PARKING</small>";
    }

    // 2) Agregar íconos SVG a los botones del sidebar
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

      // Sacar el texto sin emojis (limpia cualquier emoji al inicio)
      const raw = btn.textContent.trim();
      const clean = raw.replace(/^[\p{Emoji}\s]+/u, "").trim() || raw;

      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${svg}</svg><span>${clean}</span>`;
    });

    // Logout con ícono
    const logout = document.getElementById("logout-btn");
    if (logout) {
      const raw = logout.textContent.trim();
      const clean = raw.replace(/^[\p{Emoji}\s]+/u, "").trim() || "Cerrar sesión";
      logout.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg><span>${clean}</span>`;
    }

    // 3) Pie del sidebar con usuario
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

    // 4) Topbar: campanita + chip de usuario
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

    // 5) Reflejar el usuario cuando app.js llene #who-am-i
    const who = document.getElementById("who-am-i");
    if (who) {
      const fill = () => {
        const txt = who.textContent.trim();
        if (!txt) return;
        const [namePart, rolePart] = txt.split(",").map(s => s.trim());
        const name = namePart || "Administrador";
        const initial = name.charAt(0).toUpperCase();

        ["theme-user-initial", "theme-chip-initial"].forEach(id => {
          const el = document.getElementById(id); if (el) el.textContent = initial;
        });
        ["theme-user-name", "theme-chip-name"].forEach(id => {
          const el = document.getElementById(id); if (el) el.textContent = name;
        });
        const roleEl = document.getElementById("theme-user-role");
        if (roleEl) roleEl.textContent = rolePart || "";
      };
      fill();
      new MutationObserver(fill).observe(who, { childList: true, characterData: true, subtree: true });
    }
  }

  // Ejecutar cuando el DOM esté listo (por si acaso)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyTheme);
  } else {
    applyTheme();
  }
})();