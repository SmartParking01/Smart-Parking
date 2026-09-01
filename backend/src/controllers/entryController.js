const SpaceModel = require("../models/spaceModel");
const ReservationModel = require("../models/reservationModel");
const EntryModel = require("../models/entryModel");
const UserModel = require("../models/userModel");
const qrService = require("../services/qrService");
const { ok, fail } = require("../utils/response");

/**
 * Caso principal (sección 3 del prompt): el guarda escanea el QR.
 * Se valida, en orden: firma del QR -> existencia de la reserva -> que
 * pertenezca al usuario que dice ser -> que sea del establecimiento del
 * guarda -> que esté vigente -> que el espacio siga disponible para ingreso.
 */
async function scanQr(req, res) {
  const { signedPayload } = req.body;
  if (!signedPayload) return fail(res, "Falta el contenido del QR escaneado.");

  const verification = qrService.verifyQrPayload(signedPayload);
  if (!verification.valid) {
    return fail(res, verification.error, 400);
  }

  const reservation = await ReservationModel.findByToken(verification.qrToken);
  if (!reservation) {
    return fail(res, "La reserva asociada a este QR no existe.", 404);
  }

  if (reservation.establishment_id !== req.user.establishmentId) {
    return fail(res, "Esta reserva no corresponde a este establecimiento.", 403);
  }

  if (reservation.status !== "ACTIVE") {
    return fail(res, `La reserva no está vigente (estado actual: ${reservation.status}).`, 409);
  }

  if (new Date(reservation.expires_at) < new Date()) {
    await ReservationModel.updateStatus(reservation.id, "EXPIRED");
    await SpaceModel.compareAndSetStatus(reservation.space_id, "RESERVED", "AVAILABLE");
    return fail(res, "La reserva expiró antes de que el vehículo ingresara.", 409);
  }

  const space = await SpaceModel.findById(reservation.space_id);
  if (!space || space.status !== "RESERVED") {
    return fail(res, "El espacio reservado ya no está en estado válido para ingreso.", 409);
  }

  // Todo correcto: permitir el ingreso.
  await SpaceModel.updateStatus(space.id, "OCCUPIED");
  await ReservationModel.updateStatus(reservation.id, "USED", { usedAtIso: new Date().toISOString() });

  const entry = await EntryModel.create({
    reservationId: reservation.id,
    spaceId: space.id,
    establishmentId: reservation.establishment_id,
    userId: reservation.user_id,
    guardId: req.user.id,
    source: "RESERVATION",
  });

  const user = await UserModel.findById(reservation.user_id);
  return ok(res, {
    message: "Ingreso autorizado.",
    entry,
    space: await SpaceModel.findById(space.id),
    user: user ? UserModel.toPublic(user) : null,
  });
}

/**
 * Caso de persona sin reserva (sección 4): el guarda asigna manualmente
 * un espacio disponible. Queda registrado igual que cualquier otro ingreso.
 */
async function assignWalkIn(req, res) {
  const { spaceId } = req.body;
  if (!spaceId) return fail(res, "spaceId es obligatorio.");

  const space = await SpaceModel.findById(spaceId);
  if (!space) return fail(res, "Espacio no encontrado.", 404);
  if (space.establishment_id !== req.user.establishmentId) {
    return fail(res, "Ese espacio no pertenece a su establecimiento.", 403);
  }

  const claimed = await SpaceModel.compareAndSetStatus(spaceId, "AVAILABLE", "OCCUPIED");
  if (!claimed) {
    return fail(res, "El espacio ya no está disponible.", 409);
  }

  const entry = await EntryModel.create({
    spaceId,
    establishmentId: space.establishment_id,
    guardId: req.user.id,
    source: "WALK_IN",
  });

  return ok(res, { message: "Entrada registrada sin reserva.", entry, space: await SpaceModel.findById(spaceId) });
}

/**
 * Registro de salida: libera el espacio y cierra la entrada abierta.
 */
async function registerExit(req, res) {
  const { spaceId } = req.body;
  if (!spaceId) return fail(res, "spaceId es obligatorio.");

  const space = await SpaceModel.findById(spaceId);
  if (!space) return fail(res, "Espacio no encontrado.", 404);
  if (space.establishment_id !== req.user.establishmentId) {
    return fail(res, "Ese espacio no pertenece a su establecimiento.", 403);
  }
  if (space.status !== "OCCUPIED") {
    return fail(res, "El espacio no está marcado como ocupado.", 409);
  }

  const openEntry = await EntryModel.findOpenBySpace(spaceId);
  if (openEntry) {
    await EntryModel.registerExit(openEntry.id);
  }
  const updatedSpace = await SpaceModel.updateStatus(spaceId, "AVAILABLE");

  return ok(res, { message: "Salida registrada. Espacio liberado.", space: updatedSpace, entry: openEntry });
}

async function listOpenEntries(req, res) {
  const entries = await EntryModel.listByEstablishment(req.user.establishmentId, { onlyOpen: true });
  return ok(res, { entries });
}

async function myHistory(req, res) {
  const entries = await EntryModel.listByUser(req.user.id);
  return ok(res, { entries });
}

module.exports = { scanQr, assignWalkIn, registerExit, listOpenEntries, myHistory };
