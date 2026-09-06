const { Pool } = require("pg");

// Soporta DATABASE_URL (Supabase, Render, etc.) o variables sueltas PG*.
const useConnectionString = Boolean(process.env.DATABASE_URL);

const pool = useConnectionString
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
    })
  : new Pool({
      host: process.env.PGHOST || "localhost",
      port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
      user: process.env.PGUSER || "postgres",
      password: process.env.PGPASSWORD || "postgres",
      database: process.env.PGDATABASE || "smartparking",
      ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
    });

pool.on("error", (err) => {
  console.error("Error inesperado en el pool de PostgreSQL:", err);
});

// IMPORTANTE: este backend NO crea ni modifica el esquema. Las tablas,
// tipos ENUM, constraints, triggers y vistas ya existen en la base de datos
// (creados por 01_schema.sql) y son la fuente de verdad. El backend solo
// hace SELECT/INSERT/UPDATE sobre lo que ya está ahí.

function query(text, params) {
  return pool.query(text, params);
}

// Para operaciones que necesitan una transacción real (BEGIN/COMMIT/ROLLBACK),
// por ejemplo asignar un espacio manualmente sin pisar una asignación
// concurrente.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Prueba simple de conectividad al arrancar (no crea nada, solo confirma
// que la conexión y credenciales funcionan).
async function checkConnection() {
  await pool.query("SELECT 1");
}

module.exports = { pool, query, withTransaction, checkConnection };
