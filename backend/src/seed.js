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

// Los 8 establecimientos reales que Dulce investigó (universidades,
// hospitales privados y condominios), cada uno con su propio tipo de
// parqueo real (por eso el campo "layout", que además usa el frontend para
// dibujar el mapa en pseudo-3D de cada lugar). Ya no se maneja el segmento
// de malls.
const ESTABLISHMENTS = [
  {
    type: "Universidad",
    layout: "lots", // varios lotes con nombre propio (P2, P3, Parqueo 4), como en el plano real
    name: "Universidad Latina de Costa Rica — Campus Heredia",
    address: "Heredia, Costa Rica",
    latitude: 9.9995, longitude: -84.1165,
    zones: [
      { label: "P2", short: "P2", count: 10 },
      { label: "P3", short: "P3", count: 8 },
      { label: "Parqueo 4", short: "P4", count: 10 },
    ],
  },
  {
    type: "Universidad",
    layout: "surface-lot", // lote de superficie a nivel de calle, con espacios de discapacidad marcados
    name: "Universidad Fidelitas — Sede San Pedro",
    address: "San Pedro, San José, Costa Rica",
    latitude: 9.9355, longitude: -84.0500,
    spaces: 20, rows: ["A", "B"],
  },
  {
    type: "Hospital",
    layout: "surface-lot",
    name: "Hospital CIMA San José",
    address: "Escazú, San José, Costa Rica",
    latitude: 9.9354, longitude: -84.1493,
    spaces: 30, rows: ["A", "B", "C"],
  },
  {
    type: "Hospital",
    layout: "structured-garage", // torre de parqueo de varios niveles con barreras, como en las fotos reales
    name: "Hospital Clínica Bíblica",
    address: "San José centro, Costa Rica",
    latitude: 9.9346, longitude: -84.0839,
    zones: [
      { label: "Nivel 1", short: "N1", count: 10 },
      { label: "Nivel 2", short: "N2", count: 10 },
      { label: "Nivel 3", short: "N3", count: 8 },
    ],
  },
  {
    type: "Condominio",
    layout: "covered-small", // parqueo techado y pequeño, detrás del segundo edificio
    name: "Condominio Lake Arenal Condos",
    address: "Nuevo Arenal, Tilarán, Guanacaste, Costa Rica",
    latitude: 10.5469, longitude: -84.8994,
    spaces: 12, rows: ["A"],
  },
  {
    type: "Condominio",
    layout: "tower-shared", // torre con parqueo compartido/de visitas
    name: "Condominio de las Torres de Paseo Colón",
    address: "Paseo Colón, San José, Costa Rica",
    latitude: 9.9350, longitude: -84.0950,
    spaces: 16, rows: ["A", "B"],
  },
  {
    type: "Condominio",
    layout: "tower-shared",
    name: "Condominio Torres del Lago",
    address: "Sabana, San José, Costa Rica",
    latitude: 9.9380, longitude: -84.0980,
    spaces: 16, rows: ["A", "B"],
  },
  {
    type: "Condominio",
    layout: "visitor-only", // no existe parqueo general (cada casa tiene el suyo); esto es solo el de visitas
    name: "Condominio Lindora Bosques, Santa Ana",
    address: "Lindora, Santa Ana, San José, Costa Rica",
    latitude: 9.9270, longitude: -84.1800,
    spacesList: Array.from({ length: 12 }, (_, i) => `Visita ${i + 1}`),
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

    const totalSpaces = est.spacesList ? est.spacesList.length
      : est.zones ? est.zones.reduce((sum, z) => sum + z.count, 0)
      : est.spaces;

    const parking = await ParkingModel.create({
      establishmentId: establishment.id,
      name: est.layout === "visitor-only" ? "Parqueo de visitas (entrada única)" : "Parqueo principal (entrada única)",
      capacity: totalSpaces,
    });

    if (est.spacesList) {
      // Lista de nombres reales para mostrar (p. ej. "Visita 1".."Visita 12"),
      // pero el CÓDIGO en la base debe cumplir letra+número sin espacios ni
      // texto (chk_space_code_format: ^[A-Z]{1,2}[0-9]{1,3}$), así que el
      // código interno es A01, A02... y el nombre real queda en row_location
      // para que el mapa 2D y la vista 3D lo sigan mostrando bien agrupado.
      for (let i = 0; i < est.spacesList.length; i++) {
        const code = `A${String(i + 1).padStart(2, "0")}`;
        await SpaceModel.create({ parkingId: parking.id, code, rowLocation: "Visitas" });
      }
    } else if (est.zones) {
      // Varios lotes con nombre propio (p. ej. Universidad Latina: P2, P3, Parqueo 4).
      // El código real usa una letra por zona (A, B, C...) porque el nombre
      // "P2" ya trae un dígito y rompe chk_space_code_format; el nombre bonito
      // (P2, Nivel 1, etc.) se guarda en row_location, que es texto libre y es
      // lo que realmente usan la cuadrícula y la vista 3D para agrupar.
      const zoneLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      for (let zIdx = 0; zIdx < est.zones.length; zIdx++) {
        const zone = est.zones[zIdx];
        const letter = zoneLetters[zIdx] || "Z";
        for (let i = 1; i <= zone.count; i++) {
          const code = `${letter}${String(i).padStart(2, "0")}`; // ej. "A01" — cumple el formato exigido
          await SpaceModel.create({ parkingId: parking.id, code, rowLocation: zone.label });
        }
      }
    } else {
      // Filas simples tipo A01, A02... (lotes de superficie o garajes por nivel).
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
    }

    createdEstablishments.push({ ...est, companyId: company.id, establishmentId: establishment.id, parkingId: parking.id });
    console.log(`  -> ${est.type}: "${est.name}" (${totalSpaces} espacios, layout: ${est.layout})`);
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
