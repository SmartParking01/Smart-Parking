/* =========================================================================
   Mapa de parqueo en pseudo-3D (perspectiva isométrica con CSS 3D).
   Solo VISUAL: para reservar o gestionar espacios se sigue usando la
   cuadrícula 2D de siempre, que no se toca. Reutiliza los colores ya
   definidos en css/style.css (var(--available), var(--reserved), etc.)
   ========================================================================= */

// Config visual por tipo de establecimiento, según las fotos reales que
// Dulce consiguió (ESTACIONAMIENTOS_IDEA.pdf). La clave es el nombre EXACTO
// del establecimiento tal como queda en la base de datos (backend/src/seed.js).
const PARKING_3D_LAYOUTS = {
  "Universidad Latina de Costa Rica — Campus Heredia": {
    layout: "lots",
    building: "Campus universitario",
    photo: "assets/parking3d-u-latina.jpg",
  },
  "Universidad Fidelitas — Sede San Pedro": { layout: "surface-lot", building: "Edificio universitario" },
  "Hospital CIMA San José": { layout: "surface-lot", building: "Hospital", photo: "assets/parking3d-hospital-cima.jpg" },
  "Hospital Clínica Bíblica": { layout: "structured-garage", building: "Torre de parqueo", photo: "assets/parking3d-clinica-biblica.jpg" },
  "Condominio Lake Arenal Condos": { layout: "covered-small", building: "Condominio (parqueo techado)", photo: "assets/parking3d-lake-arenal-condos.jpg" },
  "Condominio de las Torres de Paseo Colón": { layout: "tower-shared", building: "Torre residencial" },
  "Condominio Torres del Lago": { layout: "tower-shared", building: "Torres residenciales" },
  "Condominio Lindora Bosques, Santa Ana": { layout: "visitor-only", building: "Parqueo de visitas" },
};

function p3dStatusOf(space) {
  return (space.status || space.state || "AVAILABLE").toUpperCase();
}

// Agrupa los espacios reales (los que ya vienen del backend) por su
// row_location, para poder dibujar un "lote"/nivel por grupo.
function p3dGroupSpaces(spaces) {
  const groups = {};
  const order = [];
  spaces.forEach((s) => {
    const key = s.row_location || s.rowLocation || "Zona única";
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push(s);
  });
  return order.map((key) => ({ label: key, spaces: groups[key] }));
}

/**
 * Devuelve el HTML del bloque "vista 3D" para un establecimiento.
 * @param {Array} spaces  Lista de espacios (misma forma que ya usa la app).
 * @param {string} establishmentName Nombre exacto del establecimiento.
 */
function renderParking3DBlock(spaces, establishmentName) {
  const cfg = PARKING_3D_LAYOUTS[establishmentName] || { layout: "surface-lot", building: "Parqueo" };
  const groups = p3dGroupSpaces(spaces);

  const zonesHtml = groups.map((g) => `
    <div class="p3d-zone">
      <div class="p3d-zone-label">${escapeHtmlP3d(g.label)} <span class="p3d-zone-count">${g.spaces.length} espacios</span></div>
      <div class="p3d-row">
        ${g.spaces.map((s) => `
          <div class="p3d-cell p3d-status-${p3dStatusOf(s)}" title="${escapeHtmlP3d(s.code)}">
            <span class="p3d-cell-top"></span>
            <span class="p3d-cell-code">${escapeHtmlP3d((s.code || "").split(/[\s·-]/).pop())}</span>
          </div>`).join("")}
      </div>
    </div>
  `).join("");

  const sceneHtml = cfg.photo
    ? `
      <div class="p3d-photo">
        <img src="${escapeHtmlP3d(cfg.photo)}" alt="${escapeHtmlP3d(cfg.building)}" loading="lazy" />
      </div>`
    : `
      <div class="p3d-scene p3d-layout-${cfg.layout}">
        <div class="p3d-stage">
          <div class="p3d-block p3d-building-block"><span>${escapeHtmlP3d(cfg.building)}</span></div>
          <div class="p3d-lots">
            ${zonesHtml || '<p class="muted">Sin espacios configurados todavía.</p>'}
          </div>
        </div>
      </div>`;

  return `
    <div class="p3d-wrap">
      <div class="p3d-header">
        <span class="p3d-tag">Vista 3D · ${escapeHtmlP3d(cfg.building)}</span>
        <span class="muted p3d-hint">Solo referencia visual — para reservar o gestionar usa la cuadrícula de abajo.</span>
      </div>
      ${sceneHtml}
      <div class="p3d-legend">
        <span><span class="p3d-dot p3d-status-AVAILABLE"></span> Disponible</span>
        <span><span class="p3d-dot p3d-status-RESERVED"></span> Reservado</span>
        <span><span class="p3d-dot p3d-status-OCCUPIED"></span> Ocupado</span>
        <span><span class="p3d-dot p3d-status-BLOCKED"></span> Bloqueado</span>
      </div>
    </div>
  `;
}

function escapeHtmlP3d(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
