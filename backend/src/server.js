require("dotenv").config();
const app = require("./app");
const { initSchema, pool } = require("./config/db");

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    // Crea las tablas si aún no existen (equivalente a lo que antes hacía
    // better-sqlite3 de forma síncrona al arrancar).
    await initSchema();
    app.listen(PORT, () => {
      console.log(`Smart Parking API escuchando en http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("No se pudo iniciar el servidor (revisa la conexión a PostgreSQL):", err);
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  await pool.end();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});

start();
