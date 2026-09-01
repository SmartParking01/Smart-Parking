// Envuelve un controlador async para que cualquier promesa rechazada llegue
// al middleware de manejo de errores de Express (app.js), en vez de quedar
// como un rechazo no manejado. Con better-sqlite3 (síncrono) esto no hacía
// falta; con pg (asíncrono) sí.
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
