require("dotenv").config();
const bcrypt = require("bcryptjs");
const { initSchema, pool } = require("./config/db");
const UserModel = require("./models/userModel");
const EstablishmentModel = require("./models/establishmentModel");
const SpaceModel = require("./models/spaceModel");

async function seed() {
  console.log("Sembrando datos de demostración...");

  await initSchema();

  // Establecimiento de ejemplo
  const mall = await EstablishmentModel.create({
    name: "Mall Plaza Central",
    type: "MALL",
    address: "San José, Costa Rica",
    rules: "Reserva válida por 30 minutos.",
    createdBy: null,
  });

  // Espacios en 2 filas
  const rows = ["A", "B"];
  for (const row of rows) {
    for (let i = 1; i <= 6; i++) {
      const code = `${row}${String(i).padStart(2, "0")}`;
      await SpaceModel.create({ establishmentId: mall.id, code, rowLabel: `Fila ${row}` });
    }
  }

  // Usuario admin
  const adminPass = await bcrypt.hash("Admin123!", 10);
  await UserModel.create({
    name: "Administrador Demo",
    email: "admin@smartparking.test",
    phone: "8888-0000",
    passwordHash: adminPass,
    role: "ADMIN",
    establishmentId: mall.id,
  });

  // Usuario guarda de seguridad
  const guardPass = await bcrypt.hash("Guard123!", 10);
  await UserModel.create({
    name: "Guarda Demo",
    email: "guarda@smartparking.test",
    phone: "8888-1111",
    passwordHash: guardPass,
    role: "SECURITY",
    establishmentId: mall.id,
  });

  // Usuario conductor de ejemplo
  const userPass = await bcrypt.hash("User123!", 10);
  await UserModel.create({
    name: "Conductor Demo",
    email: "conductor@smartparking.test",
    phone: "8888-2222",
    passwordHash: userPass,
    role: "USER",
  });

  console.log("Listo. Cuentas de prueba:");
  console.log("  ADMIN     -> admin@smartparking.test / Admin123!");
  console.log("  SECURITY  -> guarda@smartparking.test / Guard123!");
  console.log("  USER      -> conductor@smartparking.test / User123!");
  console.log(`Establecimiento creado: "${mall.name}" (id ${mall.id}) con 12 espacios.`);
}

seed()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
