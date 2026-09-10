require("dotenv").config();
const app = require("./app");
const { checkConnection, pool } = require("./config/db");

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    // Solo verifica que se puede conectar; el esquema ya existe en la base
    // de datos y este backend nunca lo crea ni lo modifica.
    await checkConnection();
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
