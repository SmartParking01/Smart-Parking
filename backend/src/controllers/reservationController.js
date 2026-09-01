const SpaceModel = require("../models/spaceModel");
const ReservationModel = require("../models/reservationModel");
const EstablishmentModel = require("../models/establishmentModel");
const qrService = require("../services/qrService");
const { ok, fail } = require("../utils/response");

const TTL_MINUTES = Number(process.env.RESERVATION_TTL_MINUTES || 30);

async function createReservation(req, res) {
  const { establishmentId, spaceId } = req.body;
  if (!establishmentId || !spaceId) return fail(res, "establishmentId y spaceId son obligatorios.");

  const establishment = await EstablishmentModel.findById(establishmentId);
  if (!establishment) return fail(res, "Establecimiento no encontrado.", 404);

  const space = await SpaceModel.findById(spaceId);
  if (!space || space.establishment_id !== Number(establishmentId)) {
    return fail(res, "El espacio no pertenece a ese establecimiento o no existe.", 404);
  }

  // La lógica del servidor decide el estado real: solo se reserva si sigue
  // AVAILABLE en este instante. Esto evita reservas simultáneas del mismo espacio.
  const claimed = await SpaceModel.compareAndSetStatus(spaceId, "AVAILABLE", "RESERVED");
  if (!claimed) {
    return fail(res, "Ese espacio ya no está disponible. Elige otro.", 409);
  }

  const qrToken = qrService.generateQrToken();
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000).toISOString();

  const reservation = await ReservationModel.create({
    userId: req.user.id,
    establishmentId,
    spaceId,
    qrToken,
    expiresAtIso: expiresAt,
  });

  const signedQr = qrService.signQrPayload(qrToken);
  const qrImage = await qrService.renderQrImageBase64(signedQr);

  return ok(res, { reservation, qr: { signedPayload: signedQr, image: qrImage } }, 201);
}

async function cancelReservation(req, res) {
  const reservation = await ReservationModel.findById(req.params.id);
  if (!reservation) return fail(res, "Reserva no encontrada.", 404);
  if (reservation.user_id !== req.user.id) return fail(res, "No puede cancelar una reserva ajena.", 403);
  if (reservation.status !== "ACTIVE") return fail(res, "Solo se pueden cancelar reservas activas.", 409);

  await ReservationModel.updateStatus(reservation.id, "CANCELLED");
  await SpaceModel.compareAndSetStatus(reservation.space_id, "RESERVED", "AVAILABLE");

  return ok(res, { message: "Reserva cancelada." });
}

// Libera automáticamente los espacios de reservas que ya vencieron sin usarse.
async function releaseExpiredReservations() {
  const expired = await ReservationModel.expireOverdue();
  for (const reservation of expired) {
    await SpaceModel.compareAndSetStatus(reservation.space_id, "RESERVED", "AVAILABLE");
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

  const signedQr = qrService.signQrPayload(reservation.qr_token);
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
