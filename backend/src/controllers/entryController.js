const SpaceModel = require("../models/spaceModel");
const ParkingModel = require("../models/parkingModel");
const ReservationModel = require("../models/reservationModel");
const QrModel = require("../models/qrModel");
const SessionModel = require("../models/sessionModel");
const UserModel = require("../models/userModel");
const qrService = require("../services/qrService");
const { withTransaction } = require("../config/db");
const { ok, fail } = require("../utils/response");

/**
 * El guarda escanea el QR. Se valida en orden: firma del QR -> el código
 * existe y sigue VALID -> la reserva existe y está CONFIRMED -> pertenece al
 * establecimiento del guarda -> no venció. Si todo pasa: se marca el QR
 * USED, la reserva ACTIVE (el trigger deja el espacio OCCUPIED) y se abre
 * la sesión de parqueo (parking_sessions).
 */
async function scanQr(req, res) {
  const { signedPayload } = req.body;
  if (!signedPayload) return fail(res, "Falta el contenido del QR escaneado.");

  const verification = qrService.verifyQrPayload(signedPayload);
  if (!verification.valid) return fail(res, verification.error, 400);

  const qr = await QrModel.findByToken(verification.qrToken);
  if (!qr) return fail(res, "El QR no corresponde a ninguna reserva registrada.", 404);
  if (qr.status !== "VALID") {
    return fail(res, `Este QR ya no es válido (estado: ${qr.status}).`, 409);
  }

  const reservation = await ReservationModel.findById(qr.reservation_id);
  if (!reservation) return fail(res, "La reserva asociada a este QR no existe.", 404);

  const parking = await ParkingModel.findById(reservation.parking_id);
  if (!parking || parking.establishment_id !== req.user.establishmentId) {
    return fail(res, "Esta reserva no corresponde a este establecimiento.", 403);
  }

  if (!["PENDING", "CONFIRMED"].includes(reservation.status)) {
    return fail(res, `La reserva no está vigente (estado actual: ${reservation.status}).`, 409);
  }

  if (new Date(reservation.end_time) < new Date()) {
    await ReservationModel.updateStatus(reservation.id, "EXPIRED");
    await QrModel.markExpired(qr.id);
    return fail(res, "La reserva expiró antes de que el vehículo ingresara.", 409);
  }

  await ReservationModel.updateStatus(reservation.id, "ACTIVE"); // trigger -> espacio OCCUPIED
  await QrModel.markUsed(qr.id);

  const session = await SessionModel.create({
    reservationId: reservation.id,
    spaceId: reservation.space_id,
    userId: reservation.user_id,
    attendantId: req.user.id,
    entryMethod: "RESERVATION",
  });

  const user = await UserModel.findById(reservation.user_id);
  return ok(res, {
    message: "Ingreso autorizado.",
    session,
    space: await SpaceModel.findById(reservation.space_id),
    user: user ? UserModel.toPublic(user) : null,
  });
}

/**
 * Persona sin reserva: el guarda asigna manualmente un espacio disponible.
 * Se usa una transacción con bloqueo de fila (FOR UPDATE) porque este es el
 * único caso que ya NO está protegido por el EXCLUDE constraint (no hay
 * reserva de por medio).
 */
async function assignWalkIn(req, res) {
  const { spaceId } = req.body;
  if (!spaceId) return fail(res, "spaceId es obligatorio.");

  try {
    const { session, space } = await withTransaction(async (client) => {
      const { rows } = await client.query(
        "SELECT * FROM parking_spaces WHERE id = $1 FOR UPDATE",
        [spaceId]
      );
      const spaceRow = rows[0];
      if (!spaceRow) {
        const err = new Error("Espacio no encontrado.");
        err.httpStatus = 404;
        throw err;
      }
      const parking = await ParkingModel.findById(spaceRow.parking_id);
      if (!parking || parking.establishment_id !== req.user.establishmentId) {
        const err = new Error("Ese espacio no pertenece a su establecimiento.");
        err.httpStatus = 403;
        throw err;
      }
      if (spaceRow.status !== "AVAILABLE") {
        const err = new Error("El espacio ya no está disponible.");
        err.httpStatus = 409;
        throw err;
      }

      const { rows: sessionRows } = await client.query(
        `INSERT INTO parking_sessions (space_id, attendant_id, entry_method)
         VALUES ($1, $2, 'MANUAL_ASSIGNMENT')
         RETURNING *`,
        [spaceId, req.user.id]
      );
      // El trigger trg_occupy_space_on_entry ya deja el espacio OCCUPIED.
      const { rows: updatedSpaceRows } = await client.query(
        "SELECT * FROM parking_spaces WHERE id = $1",
        [spaceId]
      );
      return { session: sessionRows[0], space: updatedSpaceRows[0] };
    });

    return ok(res, { message: "Entrada registrada sin reserva.", session, space }, 201);
  } catch (err) {
    if (err.httpStatus) return fail(res, err.message, err.httpStatus);
    throw err;
  }
}

async function registerExit(req, res) {
  const { spaceId } = req.body;
  if (!spaceId) return fail(res, "spaceId es obligatorio.");

  const space = await SpaceModel.findById(spaceId);
  if (!space) return fail(res, "Espacio no encontrado.", 404);
  const parking = await ParkingModel.findById(space.parking_id);
  if (!parking || parking.establishment_id !== req.user.establishmentId) {
    return fail(res, "Ese espacio no pertenece a su establecimiento.", 403);
  }

  const openSession = await SessionModel.findOpenBySpace(spaceId);
  if (!openSession) return fail(res, "No hay una sesión abierta en ese espacio.", 409);

  const exitMethod = openSession.entry_method === "RESERVATION" ? "QR_SCAN" : "MANUAL";
  const session = await SessionModel.registerExit(openSession.id, exitMethod); // trigger -> espacio AVAILABLE

  return ok(res, { message: "Salida registrada. Espacio liberado.", space: await SpaceModel.findById(spaceId), session });
}

async function listOpenEntries(req, res) {
  const sessions = await SessionModel.listOpenByEstablishment(req.user.establishmentId);
  return ok(res, { entries: sessions });
}

async function myHistory(req, res) {
  const sessions = await SessionModel.listByUser(req.user.id);
  return ok(res, { entries: sessions });
}

module.exports = { scanQr, assignWalkIn, registerExit, listOpenEntries, myHistory };
