require("dotenv").config();
const bcrypt = require("bcryptjs");
const { pool, query } = require("./config/db");
const UserModel = require("./models/userModel");
const CompanyModel = require("./models/companyModel");
const EstablishmentModel = require("./models/establishmentModel");
const ParkingModel = require("./models/parkingModel");
const SpaceModel = require("./models/spaceModel");

async function ensureRolesCatalog() {
  await query(
    `INSERT INTO roles (name, description) VALUES
       ('ADMIN', 'Administrador de establecimiento'),
       ('ATTENDANT', 'Guarda de seguridad'),
       ('USER', 'Conductor / usuario final')
     ON CONFLICT (name) DO NOTHING`
  );
}

// Los 8 establecimientos de este pivote: universidades, hospitales privados
// y condominios residenciales, todos con un único parqueo de una sola
// entrada/salida (ya no se maneja el segmento de malls).
const ESTABLISHMENTS = [
  {
    type: "Universidad",
    name: "Universidad Latina de Costa Rica — Campus Heredia",
    address: "Heredia, Costa Rica",
    latitude: 9.9995, longitude: -84.1165,
    spaces: 24, rows: ["A", "B"],
  },
  {
    type: "Universidad",
    name: "Universidad Fidelitas — Sede San Pedro",
    address: "San Pedro, San José, Costa Rica",
    latitude: 9.9355, longitude: -84.0500,
    spaces: 20, rows: ["A", "B"],
  },
  {
    type: "Hospital",
    name: "Hospital CIMA San José",
    address: "Escazú, San José, Costa Rica",
    latitude: 9.9354, longitude: -84.1493,
    spaces: 30, rows: ["A", "B", "C"],
  },
  {
    type: "Hospital",
    name: "Hospital Clínica Bíblica",
    address: "San José centro, Costa Rica",
    latitude: 9.9346, longitude: -84.0839,
    spaces: 28, rows: ["A", "B", "C"],
  },
  {
    type: "Condominio",
    name: "Condominio Vista Real",
    address: "Escazú, San José, Costa Rica",
    latitude: 9.9280, longitude: -84.1400,
    spaces: 16, rows: ["A"],
  },
  {
    type: "Condominio",
    name: "Condominio Trejos Montealegre",
    address: "Escazú, San José, Costa Rica",
    latitude: 9.9240, longitude: -84.1450,
    spaces: 18, rows: ["A"],
  },
  {
    type: "Condominio",
    name: "Condominio Lindora Bosques",
    address: "Santa Ana, San José, Costa Rica",
    latitude: 9.9270, longitude: -84.1800,
    spaces: 20, rows: ["A", "B"],
  },
  {
    type: "Condominio",
    name: "Condominio Villas del Río",
    address: "Heredia, Costa Rica",
    latitude: 10.0000, longitude: -84.1100,
    spaces: 14, rows: ["A"],
  },
];

function slug(name) {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function seed() {
  console.log("Sembrando los 8 establecimientos (universidades, hospitales, condominios)...");
  await ensureRolesCatalog();

  const createdEstablishments = [];

  for (const est of ESTABLISHMENTS) {
    const company = await CompanyModel.create({
      name: est.name,
      // VARCHAR(40) en la base real: se trunca el slug y se usa un sufijo
      // corto en base36 (no el timestamp completo) para no pasarse del límite.
      taxId: `TEST-${slug(est.name).slice(0, 20)}-${Date.now().toString(36)}`,
      email: `contacto@${slug(est.name)}.test`,
      phone: "2222-0000",
      address: est.address,
    });

    const establishment = await EstablishmentModel.create({
      companyId: company.id,
      name: est.name,
      address: est.address,
      description: `${est.type} — parqueo privado de una sola entrada/salida.`,
      latitude: est.latitude,
      longitude: est.longitude,
    });

    const parking = await ParkingModel.create({
      establishmentId: establishment.id,
      name: "Parqueo principal (entrada única)",
      capacity: est.spaces,
    });

    let created = 0;
    outer:
    for (const row of est.rows) {
      for (let i = 1; created < est.spaces && i <= est.spaces; i++) {
        const code = `${row}${String(i).padStart(2, "0")}`;
        await SpaceModel.create({ parkingId: parking.id, code, rowLocation: `Fila ${row}` });
        created++;
        if (created >= est.spaces) break outer;
      }
    }

    createdEstablishments.push({ ...est, companyId: company.id, establishmentId: establishment.id, parkingId: parking.id });
    console.log(`  -> ${est.type}: "${est.name}" (${est.spaces} espacios, 1 parqueo)`);
  }

  // Cuentas de prueba. El dominio @smartparking-staff.cr es lo que el
  // backend usa para reconocer personal automáticamente (ver
  // detectRoleFromEmail en authController.js); estas cuentas de seed se
  // crean directo con assignRole, pero cualquier cuenta nueva con ese mismo
  // dominio se auto-clasifica sola al registrarse.
  const first = createdEstablishments[0];

  const adminPass = await bcrypt.hash("Admin123!", 10);
  const admin = await UserModel.create({
    firstName: "Administradora", lastName: "Demo",
    email: "admin.demo@smartparking-staff.cr", phone: "8888-0000",
    passwordHash: adminPass,
  });
  await UserModel.assignRole(admin.id, "ADMIN", { companyId: first.companyId, establishmentId: first.establishmentId });

  const attendantPass = await bcrypt.hash("Guard123!", 10);
  const attendant = await UserModel.create({
    firstName: "Guarda", lastName: "Demo",
    email: "guarda.demo@smartparking-staff.cr", phone: "8888-1111",
    passwordHash: attendantPass,
  });
  await UserModel.assignRole(attendant.id, "ATTENDANT", { companyId: first.companyId, establishmentId: first.establishmentId });

  const userPass = await bcrypt.hash("User123!", 10);
  const user = await UserModel.create({
    firstName: "Conductor", lastName: "Demo",
    email: "conductor@smartparking.test", phone: "8888-2222",
    passwordHash: userPass,
  });
  await UserModel.assignRole(user.id, "USER");

  console.log("\nListo. Cuentas de prueba:");
  console.log("  ADMIN     -> admin.demo@smartparking-staff.cr / Admin123!");
  console.log("  ATTENDANT -> guarda.demo@smartparking-staff.cr / Guard123!");
  console.log("  USER      -> conductor@smartparking.test / User123!");
  console.log(`\nAmbas cuentas de personal quedan asignadas a: "${first.name}"`);
}

seed()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
