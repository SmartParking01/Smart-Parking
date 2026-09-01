const { Pool } = require("pg");

// Soporta DATABASE_URL (típico en Render/Railway/Heroku) o variables sueltas
// (PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE), típicas en instalación local.
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
  // Errores en clientes ociosos del pool (no deben tumbar el proceso)
  console.error("Error inesperado en el pool de PostgreSQL:", err);
});

// Atajo para ejecutar consultas sin manejar clientes manualmente.
function query(text, params) {
  return pool.query(text, params);
}

// ---------------------------------------------------------------------------
// Esquema de la base de datos (equivalente al que antes creaba better-sqlite3)
// ---------------------------------------------------------------------------
// Nota: users <-> establishments tiene una referencia circular
// (establishments.created_by -> users.id, users.establishment_id ->
// establishments.id). En SQLite esto no daba problema porque no valida los
// FK al crear la tabla; en Postgres la tabla referenciada debe existir antes,
// así que las tablas se crean primero sin esa relación y las llaves foráneas
// circulares se agregan después con ALTER TABLE dentro de un bloque
// idempotente (no falla si ya existen, para poder llamarse en cada arranque).
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS establishments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'OTHER',
  address TEXT,
  rules TEXT,
  created_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('USER', 'SECURITY', 'ADMIN')) DEFAULT 'USER',
  establishment_id INTEGER,
  reset_token TEXT,
  reset_token_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_establishments_created_by') THEN
    ALTER TABLE establishments
      ADD CONSTRAINT fk_establishments_created_by
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_establishment') THEN
    ALTER TABLE users
      ADD CONSTRAINT fk_users_establishment
      FOREIGN KEY (establishment_id) REFERENCES establishments(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS parking_spaces (
  id SERIAL PRIMARY KEY,
  establishment_id INTEGER NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  row_label TEXT,
  status TEXT NOT NULL CHECK (status IN ('AVAILABLE','RESERVED','OCCUPIED','BLOCKED')) DEFAULT 'AVAILABLE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (establishment_id, code)
);

CREATE TABLE IF NOT EXISTS reservations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  establishment_id INTEGER NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  space_id INTEGER NOT NULL REFERENCES parking_spaces(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE','USED','CANCELLED','EXPIRED')) DEFAULT 'ACTIVE',
  qr_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS entries (
  id SERIAL PRIMARY KEY,
  reservation_id INTEGER REFERENCES reservations(id) ON DELETE SET NULL,
  space_id INTEGER NOT NULL REFERENCES parking_spaces(id) ON DELETE CASCADE,
  establishment_id INTEGER NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  guard_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exit_time TIMESTAMPTZ,
  source TEXT NOT NULL CHECK (source IN ('RESERVATION','WALK_IN')) DEFAULT 'WALK_IN'
);

CREATE INDEX IF NOT EXISTS idx_spaces_establishment ON parking_spaces(establishment_id);
CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_entries_establishment ON entries(establishment_id);
`;

let schemaReady = null;

// Crea las tablas si no existen. Es seguro llamarla varias veces (idempotente).
function initSchema() {
  if (!schemaReady) {
    schemaReady = pool.query(SCHEMA_SQL);
  }
  return schemaReady;
}

module.exports = { pool, query, initSchema };
