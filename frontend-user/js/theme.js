// =============================================================================
// theme.js (user) — Rediseña el HOME como la foto. NO toca la lógica de app.js.
// =============================================================================
(function () {

  // Mapeo foto ↔ establecimiento (archivo aparte: parking-images.js)
  function getImageFor(establishmentName, index) {
    const map = window.PARKING_IMAGES || {};
    // 1) Coincidencia exacta
    if (map[establishmentName]) return map[establishmentName];
    // 2) Coincidencia por palabras clave (contains, case-insensitive)
    const nameLower = (establishmentName || "").toLowerCase();
    for (const key in map) {
      if (nameLower.includes(key.toLowerCase())) return map[key];
    }
    // 3) Fallback por índice
    const FALLBACKS = [
      "assets/parking-u-latina.jpg",
      "assets/parking-u-fidelitas.jpg",
      "assets/parking-clinica-biblica.jpg",
      "assets/parking-hospital-cima.jpg",
      "assets/parking-vista-real.jpg",
      "assets/parking-villas-del-rio.jpg",
      "assets/parking-trejos-montealegre.jpg",
      "assets/parking-bosques-lindora.jpg"
    ];
    return FALLBACKS[index % FALLBACKS.length];
  }

  function injectLogoCleanup() {
    const logo = document.getElementById("app-logo");
    if (logo) logo.classList.add("logo-clean");
  }

  // ---------------------------------------------------------------
  // HOME: rediseñar
  // ---------------------------------------------------------------
  function renderHome() {
    const view = document.getElementById("app-view");
    if (!view) return;

    if (view.dataset.themed === "home") return;

    const originalItems = Array.from(view.querySelectorAll(".establishment-item"));
    if (originalItems.length === 0 && !view.querySelector(".card.hero")) return;

    view.dataset.themed = "home";

    const establishments = originalItems.map((item, i) => {
      const nameEl = item.querySelector(".establishment-info h3");
      const addrEl = item.querySelector(".establishment-info p");
      const pillEl = item.querySelector(".availability-pill");
      const name = nameEl ? nameEl.textContent.trim() : "Parqueo";
      return {
        name,
        address: addrEl ? addrEl.textContent.trim() : "",
        availability: pillEl ? pillEl.textContent.trim() : "",
        availClass: pillEl ? (pillEl.classList.contains("high") ? "high" :
                              pillEl.classList.contains("mid") ? "mid" : "low") : "high",
        img: getImageFor(name, i)
      };
    });

    view.innerHTML = `
      <div class="home-hero">
        <div class="home-hero-img"></div>
        <div class="home-hero-overlay"></div>
        <div class="home-hero-content">
          <h1>¡Hola!</h1>
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

    view.querySelectorAll(".home-parking").forEach((card, idx) => {
      card.onclick = () => {
        const original = originalItems[idx];
        if (original) original.click();
      };
    });

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
          const list = document.querySelector(".home-parking-list");
          if (list) list.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (action === "map") {
          const map = document.getElementById("geo-map");
          if (map) map.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      };
    });
  }

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

  function runAll() {
    injectLogoCleanup();
    if (!window.location.hash || window.location.hash === "#/home") {
      renderHome();
    }
    decorateEstablishments();
    decorateInputs();
    decorateButtons();
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runAll);
  } else {
    runAll();
  }

  const viewEl = document.getElementById("app-view");
  if (viewEl) {
    new MutationObserver(() => {
      if (!window.location.hash || window.location.hash === "#/home") {
        setTimeout(renderHome, 30);
      } else {
        decorateEstablishments();
        decorateInputs();
        decorateButtons();
      }
    }).observe(viewEl, { childList: true, subtree: false });
  }

  window.addEventListener("hashchange", () => {
    const v = document.getElementById("app-view");
    if (v) delete v.dataset.themed;
    setTimeout(runAll, 60);
  });

  setTimeout(runAll, 150);
  setTimeout(runAll, 500);
  setTimeout(runAll, 1200);
})();