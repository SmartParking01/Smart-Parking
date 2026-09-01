const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const establishmentRoutes = require("./routes/establishmentRoutes");
const spaceRoutes = require("./routes/spaceRoutes");
const reservationRoutes = require("./routes/reservationRoutes");
const entryRoutes = require("./routes/entryRoutes");
const statsRoutes = require("./routes/statsRoutes");
const userRoutes = require("./routes/userRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ success: true, message: "Smart Parking API activa." }));

app.use("/api/auth", authRoutes);
app.use("/api/establishments", establishmentRoutes);
app.use("/api/spaces", spaceRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/entries", entryRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/users", userRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Ruta no encontrada." });
});

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: "Error interno del servidor." });
});

module.exports = app;
