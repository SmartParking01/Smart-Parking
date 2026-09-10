require("dotenv").config();
const bcrypt = require("bcryptjs");
const { pool, query } = require("./config/db");
const UserModel = require("./models/userModel");
const CompanyModel = require("./models/companyModel");
const EstablishmentModel = require("./models/establishmentModel");
const ParkingModel = require("./models/parkingModel");
const SpaceModel = require("./models/spaceModel");

async function ensureRolesCatalog() {
  // El catálogo de roles ya debería existir (tabla `roles`, valores del ENUM
  // role_name_t), pero por si 02_seed.sql no se corrió todavía en esta base,
  // lo aseguramos de forma idempotente sin tocar el esquema.
  await query(
    `INSERT INTO roles (name, description) VALUES
       ('ADMIN', 'Administrador de establecimiento'),
       ('ATTENDANT', 'Guarda de seguridad'),
       ('USER', 'Conductor / usuario final')
     ON CONFLICT (name) DO NOTHING`
  );
}

async function seed() {
  console.log("Sembrando datos de demostración (esquema real: companies -> establishments -> parkings -> parking_spaces)...");

  await ensureRolesCatalog();

  const company = await CompanyModel.create({
    name: "Grupo Plaza S.A.",
    taxId: `TEST-${Date.now()}`,
    email: "contacto@grupoplaza.test",
    phone: "2222-0000",
    address: "San José, Costa Rica",
  });

  const establishment = await EstablishmentModel.create({
    companyId: company.id,
    name: "Mall Plaza Central",
    address: "San José, Costa Rica",
    description: "Parqueo del mall.",
    latitude: 9.9281,
    longitude: -84.0907,
  });

  const parking = await ParkingModel.create({
    establishmentId: establishment.id,
    name: "Parqueo Principal",
    capacity: 12,
  });

  const rows = ["A", "B"];
  for (const row of rows) {
    for (let i = 1; i <= 6; i++) {
      const code = `${row}${String(i).padStart(2, "0")}`;
      await SpaceModel.create({ parkingId: parking.id, code, rowLocation: `Fila ${row}` });
    }
  }

  const adminPass = await bcrypt.hash("Admin123!", 10);
  const admin = await UserModel.create({
    firstName: "Administrador",
    lastName: "Demo",
    email: "admin@smartparking.test",
    phone: "8888-0000",
    passwordHash: adminPass,
  });
  await UserModel.assignRole(admin.id, "ADMIN", { companyId: company.id, establishmentId: establishment.id });

  const attendantPass = await bcrypt.hash("Guard123!", 10);
  const attendant = await UserModel.create({
    firstName: "Guarda",
    lastName: "Demo",
    email: "guarda@smartparking.test",
    phone: "8888-1111",
    passwordHash: attendantPass,
  });
  await UserModel.assignRole(attendant.id, "ATTENDANT", { companyId: company.id, establishmentId: establishment.id });

  const userPass = await bcrypt.hash("User123!", 10);
  const user = await UserModel.create({
    firstName: "Conductor",
    lastName: "Demo",
    email: "conductor@smartparking.test",
    phone: "8888-2222",
    passwordHash: userPass,
  });
  await UserModel.assignRole(user.id, "USER");

  console.log("Listo. Cuentas de prueba:");
  console.log("  ADMIN     -> admin@smartparking.test / Admin123!");
  console.log("  ATTENDANT -> guarda@smartparking.test / Guard123!");
  console.log("  USER      -> conductor@smartparking.test / User123!");
  console.log(`Empresa: "${company.name}" > Establecimiento: "${establishment.name}" > Parqueo: "${parking.name}" (12 espacios)`);
}

seed()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
