const SpaceModel = require("../models/spaceModel");
const ParkingModel = require("../models/parkingModel");
const ReservationModel = require("../models/reservationModel");
const QrModel = require("../models/qrModel");
const qrService = require("../services/qrService");
const { ok, fail } = require("../utils/response");

const TTL_MINUTES = Number(process.env.RESERVATION_TTL_MINUTES || 30);

async function createReservation(req, res) {
  const { spaceId } = req.body;
  if (!spaceId) return fail(res, "spaceId es obligatorio.");

  const space = await SpaceModel.findById(spaceId);
  if (!space) return fail(res, "El espacio no existe.", 404);

  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + TTL_MINUTES * 60 * 1000);

  let reservation;
  try {
    // No hace falta verificar disponibilidad antes: el EXCLUDE constraint de
    // la tabla reservations rechaza el INSERT si el espacio ya está
    // comprometido en ese rango de tiempo (incluso ante solicitudes
    // simultáneas), y el trigger deja el espacio en RESERVED automáticamente.
    reservation = await ReservationModel.create({
      userId: req.user.id,
      spaceId,
      parkingId: space.parking_id,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status: "CONFIRMED",
    });
  } catch (err) {
    if (err.code === "23P01") {
      // exclusion_violation
      return fail(res, "Ese espacio ya no está disponible en este horario. Elige otro.", 409);
    }
    throw err;
  }

  const qrToken = qrService.generateQrToken();
  await QrModel.create({ reservationId: reservation.id, token: qrToken, expiresAt: endTime.toISOString() });

  const signedQr = qrService.signQrPayload(qrToken);
  const qrImage = await qrService.renderQrImageBase64(signedQr);

  return ok(res, { reservation, qr: { signedPayload: signedQr, image: qrImage } }, 201);
}

async function cancelReservation(req, res) {
  const reservation = await ReservationModel.findById(req.params.id);
  if (!reservation) return fail(res, "Reserva no encontrada.", 404);
  if (reservation.user_id !== req.user.id) return fail(res, "No puede cancelar una reserva ajena.", 403);
  if (!["PENDING", "CONFIRMED"].includes(reservation.status)) {
    return fail(res, "Solo se pueden cancelar reservas pendientes o confirmadas.", 409);
  }

  await ReservationModel.updateStatus(reservation.id, "CANCELLED"); // el trigger libera el espacio
  const validQr = await QrModel.findValidByReservation(reservation.id);
  if (validQr) await QrModel.markRevoked(validQr.id);

  return ok(res, { message: "Reserva cancelada." });
}

async function releaseExpiredReservations() {
  const expired = await ReservationModel.expireOverdue(); // el trigger libera el espacio
  for (const reservation of expired) {
    const validQr = await QrModel.findValidByReservation(reservation.id);
    if (validQr) await QrModel.markExpired(validQr.id);
  }
}

async function myReservations(req, res) {
  await releaseExpiredReservations();
  const reservations = await ReservationModel.listByUser(req.user.id);
  return ok(res, { reservations });
}

async function getQrImage(req, res) {
  const reservation = await ReservationModel.findById(req.params.id);
  if (!reservation) return fail(res, "Reserva no encontrada.", 404);
  if (reservation.user_id !== req.user.id) return fail(res, "No puede ver el QR de una reserva ajena.", 403);

  const validQr = await QrModel.findValidByReservation(reservation.id);
  if (!validQr) return fail(res, "Esta reserva ya no tiene un QR vigente.", 409);

  const signedQr = qrService.signQrPayload(validQr.token);
  const image = await qrService.renderQrImageBase64(signedQr);
  return ok(res, { qr: { signedPayload: signedQr, image }, reservation });
}

async function listForEstablishment(req, res) {
  const { status } = req.query;
  const reservations = await ReservationModel.listByEstablishment(req.params.establishmentId, status || null);
  return ok(res, { reservations });
}

module.exports = {
  createReservation,
  cancelReservation,
  myReservations,
  getQrImage,
  listForEstablishment,
  releaseExpiredReservations,
};
