// =============================================================================
// theme.js (user) — Decoración visual. NO toca la lógica de app.js.
// =============================================================================
(function () {
  // ---------------------------------------------------------------
  // Estilos específicos que dependen de clases que no existen en CSS
  // ---------------------------------------------------------------
  function injectLogoCleanup() {
    // El PNG del logo tiene fondo blanco — usamos mix-blend-mode para
    // que se disuelva sobre el header oscuro. Si el PNG ya es transparente,
    // igual funciona perfecto.
    const logo = document.getElementById("app-logo");
    if (logo) logo.classList.add("logo-clean");
  }

  // ---------------------------------------------------------------
  // Decorar las tarjetas de establecimientos
  // ---------------------------------------------------------------
  function decorateEstablishments() {
    document.querySelectorAll(".establishment-item").forEach((item) => {
      if (item.dataset.themed) return;
      item.dataset.themed = "1";

      // Ícono: si está vacío, meter SVG de edificio
      const iconEl = item.querySelector(".establishment-icon");
      if (iconEl && !iconEl.querySelector("svg")) {
        iconEl.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:22px;height:22px;color:#fff">
            <path d="M3 21h18M5 21V7l7-5 7 5v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01"/>
          </svg>`;
      }
    });
  }

  // ---------------------------------------------------------------
  // Aplicar estilo hero a la card de "Reserva tu espacio"
  // ---------------------------------------------------------------
  function decorateHeroCards() {
    document.querySelectorAll(".card").forEach((card) => {
      if (card.classList.contains("hero")) return;
      // Si la card tiene h2 grande y párrafo, y es una card suelta, tratarla como hero
      const h2 = card.querySelector(":scope > h2");
      const p = card.querySelector(":scope > p");
      if (h2 && p && !card.querySelector("table") && !card.querySelector(".input-group")) {
        card.classList.add("hero");
      }
    });
  }

  // ---------------------------------------------------------------
  // Refinar el grid de espacios si falta el legend
  // ---------------------------------------------------------------
  function decorateSpaceGrids() {
    document.querySelectorAll(".space-grid").forEach((grid) => {
      if (grid.dataset.themed) return;
      grid.dataset.themed = "1";
    });
  }

  // ---------------------------------------------------------------
  // Ajustar inputs a estilo dark
  // ---------------------------------------------------------------
  function decorateInputs() {
    document.querySelectorAll(".input-group input, .input-group select").forEach((inp) => {
      inp.classList.add("dark-input");
    });
  }

  // ---------------------------------------------------------------
  // Decorar badges de QR, botones "Confirmar reserva" → amarillo
  // ---------------------------------------------------------------
  function decorateButtons() {
    document.querySelectorAll(".btn").forEach((btn) => {
      const text = btn.textContent.trim().toLowerCase();
      if (text.includes("confirmar reserva") || text.includes("reservar")) {
        btn.classList.add("yellow");
      }
    });
  }

  // ---------------------------------------------------------------
  // Ejecutar todo
  // ---------------------------------------------------------------
  function runAll() {
    injectLogoCleanup();
    decorateEstablishments();
    decorateHeroCards();
    decorateSpaceGrids();
    decorateInputs();
    decorateButtons();
  }

  // Arranque
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runAll);
  } else {
    runAll();
  }

  // Observador del #app-view: cada vez que el router repinte la vista,
  // volvemos a decorar. (No modifica nada de app.js.)
  const viewEl = document.getElementById("app-view");
  if (viewEl) {
    new MutationObserver(() => {
      decorateEstablishments();
      decorateHeroCards();
      decorateSpaceGrids();
      decorateInputs();
      decorateButtons();
    }).observe(viewEl, { childList: true, subtree: true });
  }

  // Observador del #bottom-nav por si app.js lo toca
  const navEl = document.getElementById("bottom-nav");
  if (navEl) {
    new MutationObserver(runAll).observe(navEl, { childList: true, subtree: false });
  }

  // Reintentos por si acaso
  setTimeout(runAll, 100);
  setTimeout(runAll, 400);
  setTimeout(runAll, 1000);
})();