// =============================================================================
// theme.js — Solo decoración visual. NO toca la lógica de app.js.
// Corrige el style inline "display:flex" que app.js pone en #shell.
// =============================================================================
(function () {
  const NAV_ICONS = {
    "#/dashboard":    '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    "#/entries":      '<path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
    "#/exits":        '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
    "#/parking":      '<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2"/>',
    "#/reservations": '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    "#/spaces":       '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    "#/establishments":'<path d="M3 21h18M5 21V7l7-5 7 5v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01"/>',
    "#/staff":        '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    "#/stats":        '<path d="M3 21h18M7 17v-6M12 17V7M17 17v-4"/>'
  };

  const STAT_ICONS = {
    "Disponibles": { cls: "green",  svg: '<path d="M5 17h14M5 17V9l2-5h10l2 5v8M7 17v2a1 1 0 001 1h1a1 1 0 001-1v-2M14 17v2a1 1 0 001 1h1a1 1 0 001-1v-2"/>' },
    "Reservados":  { cls: "yellow", svg: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>' },
    "Ocupados":    { cls: "blue",   svg: '<path d="M5 17h14M5 17V9l2-5h10l2 5v8M7 17v2a1 1 0 001 1h1a1 1 0 001-1v-2M14 17v2a1 1 0 001 1h1a1 1 0 001-1v-2"/>' },
    "Ocupación actual":  { cls: "green",  svg: '<path d="M3 21h18M7 17v-6M12 17V7M17 17v-4"/>' },
    "Espacios ocupados": { cls: "blue",   svg: '<path d="M5 17h14M5 17V9l2-5h10l2 5v8"/>' },
    "Total de espacios": { cls: "yellow", svg: '<rect x="3" y="6" width="18" height="15" rx="2"/>' }
  };

  // ---------------------------------------------------------------
  // CORRECCIÓN CLAVE: quitar el style="display:flex" que app.js pone
  // ---------------------------------------------------------------
  function fixShellDisplay() {
    const shell = document.getElementById("shell");
    if (!shell) return;
    // app.js pone esto → lo borramos para que gane el CSS (display:grid)
    if (shell.style.display === "flex" || shell.style.display === "block") {
      shell.style.removeProperty("display");
    }
  }

  // ---------------------------------------------------------------
  // BRAND: logo + "SMART PARKING" al lado
  // ---------------------------------------------------------------
  function fixSidebar() {
    const brand = document.querySelector(".brand");
    if (brand) {
      const brandRow = brand.querySelector(".brand-row") || brand;

      const oldName = brandRow.querySelector(".brand-name");
      if (oldName) oldName.remove();

      const img = brandRow.querySelector("#app-logo, img");

      let brandText = brandRow.querySelector(".brand-text");
      if (!brandText) {
        brandText = document.createElement("div");
        brandText.className = "brand-text";
        brandText.innerHTML = "SMART<small>PARKING</small>";
        if (img && img.nextSibling) brandRow.insertBefore(brandText, img.nextSibling);
        else brandRow.appendChild(brandText);
      }

      const oldSub = brand.querySelector(".brand-sub");
      if (oldSub) oldSub.style.display = "none";
    }

    // Botones del sidebar
    document.querySelectorAll("#side-nav .side-btn, #logout-btn").forEach((btn) => {
      if (btn.querySelector("svg")) return;
      const route = btn.getAttribute("data-route");
      const svg = route ? NAV_ICONS[route]
                        : '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>';
      if (!svg) return;
      let text = btn.textContent.trim();
      text = text.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\s]+/u, "").trim() || text;
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${svg}</svg><span>${text}</span>`;
    });

    // Pie del sidebar
    const sidebar = document.getElementById("sidebar");
    if (sidebar && !sidebar.querySelector(".side-foot")) {
      const foot = document.createElement("div");
      foot.className = "side-foot";
      foot.innerHTML = `
        <div class="side-user">
          <div class="side-user-icon" id="theme-user-initial">A</div>
          <div class="side-user-info">
            <strong id="theme-user-name">Administrador</strong>
            <span id="theme-user-role">Cargando…</span>
          </div>
        </div>`;
      sidebar.appendChild(foot);
    }

    // Topbar right
    const topbar = document.getElementById("topbar");
    if (topbar && !topbar.querySelector(".topbar-right")) {
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

    // Sincronizar usuario con #who-am-i
    const who = document.getElementById("who-am-i");
    if (who && who.textContent.trim()) {
      const [namePart, rolePart] = who.textContent.split(",").map(s => s.trim());
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
    }
  }

  // ---------------------------------------------------------------
  // Decorar las cards de stats (agrega .stat y .stat-icon)
  // ---------------------------------------------------------------
  function decorateStatCards() {
    const view = document.getElementById("view");
    if (!view) return;

    view.querySelectorAll(".grid-3, .grid-4").forEach((grid) => {
      grid.querySelectorAll(":scope > .card").forEach((card) => {
        if (card.classList.contains("stat")) return;
        const labelNode = card.querySelector(":scope > .stat-label");
        const valueNode = card.querySelector(":scope > .stat-value");
        if (!labelNode || !valueNode) return;

        const labelText = labelNode.textContent.trim();
        const info = STAT_ICONS[labelText];
        const valueHTML = valueNode.outerHTML;

        card.classList.add("stat");
        const iconHTML = info
          ? `<div class="stat-head"><div class="stat-icon ${info.cls}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${info.svg}</svg></div></div>`
          : "";
        card.innerHTML = `${iconHTML}<div><div class="stat-label">${labelText}</div>${valueHTML}</div>`;
      });
    });

    // Card "Ocupación total" suelta
    view.querySelectorAll(":scope > .card").forEach((card) => {
      if (card.classList.contains("stat")) return;
      if (card.querySelector(".stat-icon")) return;

      const labelNode = card.querySelector(":scope > .stat-label");
      const valueNode = card.querySelector(":scope > .stat-value");
      if (!labelNode || !valueNode) return;

      const labelText = labelNode.textContent.trim();
      const info = STAT_ICONS[labelText];
      if (!info) return;

      const muted = card.querySelector(":scope > .muted");
      const mutedHTML = muted ? muted.outerHTML : "";
      const valueHTML = valueNode.outerHTML;

      card.classList.add("stat");
      card.innerHTML = `
        <div class="stat-head">
          <div class="stat-icon ${info.cls}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${info.svg}</svg></div>
        </div>
        <div>
          <div class="stat-label">${labelText}</div>
          ${valueHTML}
        </div>
        ${mutedHTML}`;
    });
  }

  // ---------------------------------------------------------------
  // Ejecuta todo
  // ---------------------------------------------------------------
  function runAll() {
    fixShellDisplay();
    fixSidebar();
    decorateStatCards();
  }

  // ---------------------------------------------------------------
  // OBSERVER CLAVE: vigila #shell para quitarle el display:flex inline
  // que app.js pone cada vez que hace afterLogin() o router()
  // ---------------------------------------------------------------
  function watchShell() {
    const shell = document.getElementById("shell");
    if (!shell) return;
    fixShellDisplay(); // por si ya está mal

    const shellObserver = new MutationObserver(() => {
      if (shell.style.display === "flex" || shell.style.display === "block") {
        shell.style.removeProperty("display");
      }
    });
    shellObserver.observe(shell, {
      attributes: true,
      attributeFilter: ["style"]
    });
  }

  // Arranca
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      watchShell();
      runAll();
    });
  } else {
    watchShell();
    runAll();
  }

  // Observa el #view para decorar tras cada router()
  const viewEl = document.getElementById("view");
  if (viewEl) {
    new MutationObserver(() => {
      fixShellDisplay();
      decorateStatCards();
    }).observe(viewEl, { childList: true, subtree: false });
  }

  // Observa el topbar y sidebar por si aparecen nuevos elementos
  const topbarEl = document.getElementById("topbar");
  if (topbarEl) {
    new MutationObserver(fixSidebar).observe(topbarEl, { childList: true, subtree: false });
  }

  // Reintentos por si acaso
  setTimeout(runAll, 100);
  setTimeout(runAll, 400);
  setTimeout(runAll, 1000);
  setTimeout(fixShellDisplay, 1500);
})();