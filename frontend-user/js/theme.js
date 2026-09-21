// =============================================================================
// theme.js (user) — Rediseña el HOME como la foto. NO toca la lógica de app.js.
// =============================================================================
(function () {

  // Lista de imágenes de relleno por si no tenemos una URL del backend
  const FALLBACK_IMGS = [
    "https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?auto=format&fit=crop&w=600&q=70",
    "https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=600&q=70",
    "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=600&q=70",
    "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=600&q=70"
  ];
  function imgFor(index) {
    return FALLBACK_IMGS[index % FALLBACK_IMGS.length];
  }

  // ---------------------------------------------------------------
  // Limpieza del logo blanco (mix-blend-mode)
  // ---------------------------------------------------------------
  function injectLogoCleanup() {
    const logo = document.getElementById("app-logo");
    if (logo) logo.classList.add("logo-clean");
  }

  // ---------------------------------------------------------------
  // HOME: rediseñar la vista completa
  // ---------------------------------------------------------------
  function renderHome() {
    const view = document.getElementById("app-view");
    if (!view) return;

    // Detectar si ya lo reescribimos (para no borrar la lista original)
    if (view.dataset.themed === "home") {
      // Si ya está armado, refrescamos solo las tarjetas de establecimientos
      decorateHome();
      return;
    }

    // Guardar los items de establecimientos que app.js generó
    const originalItems = Array.from(view.querySelectorAll(".establishment-item"));

    // Si no hay items, no hacemos nada (probablemente otra ruta)
    if (originalItems.length === 0 && !view.querySelector(".card.hero")) return;

    view.dataset.themed = "home";

    // Extraer datos
    const establishments = originalItems.map((item, i) => {
      const nameEl = item.querySelector(".establishment-info h3");
      const addrEl = item.querySelector(".establishment-info p");
      const pillEl = item.querySelector(".availability-pill");
      return {
        name: nameEl ? nameEl.textContent.trim() : "Parqueo",
        address: addrEl ? addrEl.textContent.trim() : "",
        availability: pillEl ? pillEl.textContent.trim() : "",
        availClass: pillEl ? (pillEl.classList.contains("high") ? "high" :
                              pillEl.classList.contains("mid") ? "mid" : "low") : "high",
        img: imgFor(i)
      };
    });

    // Extraer el nombre del usuario si app.js lo dejó en algún lado
    // (usamos un saludo genérico si no hay)
    const helloName = "¡Hola!";

    // Reconstruir la vista
    view.innerHTML = `
      <div class="home-hero">
        <div class="home-hero-img"></div>
        <div class="home-hero-overlay"></div>
        <div class="home-hero-content">
          <h1>${helloName}</h1>
          <p>¿A dónde vamos hoy?</p>
        </div>
      </div>

      <div class="home-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input type="text" placeholder="Buscar parqueos, centros comerciales, etc." disabled />
      </div>

      <div class="home-actions">
        <button class="home-action" data-action="map">
          <span class="ha-icon ha-blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s-8-8-8-13a8 8 0 1116 0c0 5-8 13-8 13z"/>
              <circle cx="12" cy="9" r="2.5"/>
            </svg>
          </span>
          <span>Mapa</span>
        </button>
        <button class="home-action" data-action="reserve">
          <span class="ha-icon ha-green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
          </span>
          <span>Reservar</span>
        </button>
        <button class="home-action" data-action="my-reservations">
          <span class="ha-icon ha-yellow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
          </span>
          <span>Mis reservas</span>
        </button>
        <button class="home-action" data-action="profile">
          <span class="ha-icon ha-slate">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>
            </svg>
          </span>
          <span>Perfil</span>
        </button>
      </div>

      <div class="home-section-head">
        <h3>Parqueos cercanos</h3>
        <a>Ver todos</a>
      </div>

      <div class="home-parking-list">
        ${establishments.map((e, i) => `
          <div class="home-parking" data-idx="${i}">
            <div class="home-parking-img" style="background-image:url('${e.img}')"></div>
            <div class="home-parking-body">
              <h4>${escapeHtml(e.name)}</h4>
              <div class="home-parking-meta">
                <span>${escapeHtml(e.address || "Ubicación no disponible")}</span>
                <span class="price">₡500/h</span>
              </div>
              <span class="home-parking-pill ${e.availClass}">${escapeHtml(e.availability || "Disponible")}</span>
            </div>
          </div>
        `).join("")}
      </div>
    `;

    // Click en una tarjeta → navega al establecimiento (usa la ruta real de app.js)
    view.querySelectorAll(".home-parking").forEach((card, idx) => {
      card.onclick = () => {
        const original = originalItems[idx];
        if (original) original.click();
      };
    });

    // Click en las acciones del grid → simular clicks en los nav-btn originales
    view.querySelectorAll(".home-action").forEach((btn) => {
      btn.onclick = () => {
        const action = btn.dataset.action;
        if (action === "profile") {
          const profileBtn = document.querySelector('#bottom-nav .nav-btn[data-route="#/profile"]');
          if (profileBtn) profileBtn.click();
        } else if (action === "my-reservations") {
          const histBtn = document.querySelector('#bottom-nav .nav-btn[data-route="#/history"]');
          if (histBtn) histBtn.click();
        } else if (action === "reserve") {
          // "Reservar" = scroll a la lista de parqueos cercanos
          const list = document.querySelector(".home-parking-list");
          if (list) list.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (action === "map") {
          // "Mapa" = scroll al final (donde suele estar el mapa si existe)
          const map = document.getElementById("geo-map");
          if (map) map.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      };
    });
  }

  function decorateHome() {
    // Placeholder para futura expansión
  }

  // ---------------------------------------------------------------
  // Decorar otras vistas (reservas, perfil, establecimiento)
  // ---------------------------------------------------------------
  function decorateEstablishments() {
    document.querySelectorAll(".establishment-item").forEach((item) => {
      if (item.dataset.themed) return;
      item.dataset.themed = "1";
      const iconEl = item.querySelector(".establishment-icon");
      if (iconEl && !iconEl.querySelector("svg")) {
        iconEl.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:22px;height:22px;color:#fff">
            <path d="M12 22s-8-8-8-13a8 8 0 1116 0c0 5-8 13-8 13z"/>
            <circle cx="12" cy="9" r="2.5"/>
          </svg>`;
      }
    });
  }

  function decorateInputs() {
    document.querySelectorAll(".input-group input, .input-group select").forEach((inp) => {
      inp.classList.add("dark-input");
    });
  }

  function decorateButtons() {
    document.querySelectorAll(".btn").forEach((btn) => {
      const text = btn.textContent.trim().toLowerCase();
      if (text.includes("confirmar reserva") || text === "reservar") {
        btn.classList.add("yellow");
      }
    });
  }

  // ---------------------------------------------------------------
  // Ejecutar todo
  // ---------------------------------------------------------------
  function runAll() {
    injectLogoCleanup();
    // Solo rediseñamos home cuando estamos en home
    if (!window.location.hash || window.location.hash === "#/home") {
      renderHome();
    }
    decorateEstablishments();
    decorateInputs();
    decorateButtons();
  }

  // ---------------------------------------------------------------
  // Escapar HTML
  // ---------------------------------------------------------------
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  // Arranque
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runAll);
  } else {
    runAll();
  }

  // Observador del #app-view
  const viewEl = document.getElementById("app-view");
  if (viewEl) {
    new MutationObserver(() => {
      // Solo intentamos rediseñar el home si estamos en esa ruta
      if (!window.location.hash || window.location.hash === "#/home") {
        // Esperar un tick para que app.js termine de pintar
        setTimeout(renderHome, 30);
      } else {
        decorateEstablishments();
        decorateInputs();
        decorateButtons();
      }
    }).observe(viewEl, { childList: true, subtree: false });
  }

  // Al cambiar el hash, resetear el flag para que el próximo render se rehaga
  window.addEventListener("hashchange", () => {
    const v = document.getElementById("app-view");
    if (v) delete v.dataset.themed;
    setTimeout(runAll, 60);
  });

  // Reintentos
  setTimeout(runAll, 150);
  setTimeout(runAll, 500);
  setTimeout(runAll, 1200);
})();