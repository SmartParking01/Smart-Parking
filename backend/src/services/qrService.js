const jwt = require("jsonwebtoken");
const QRCode = require("qrcode");
const { v4: uuidv4 } = require("uuid");

/**
 * El QR nunca contiene datos personales del usuario. Contiene únicamente:
 *  - jti: identificador único de la reserva (también se guarda en la BD como qr_token)
 *  - reservationRef: un identificador aleatorio adicional, sin significado fuera del backend
 * El contenido va firmado con QR_SECRET, así que modificar el QR invalida la firma
 * y el backend rechaza la validación (no se puede "fabricar" una reserva falsa).
 */
function generateQrToken() {
  return uuidv4();
}

function signQrPayload(qrToken) {
  return jwt.sign({ jti: qrToken }, process.env.QR_SECRET, { expiresIn: "1y" });
  // Nota: la expiración real de la reserva se controla en la tabla `reservations`
  // (columna expires_at), no en la firma del QR. El JWT solo protege la integridad.
}

function verifyQrPayload(signedPayload) {
  try {
    const decoded = jwt.verify(signedPayload, process.env.QR_SECRET);
    return { valid: true, qrToken: decoded.jti };
  } catch (err) {
    return { valid: false, error: "QR inválido, alterado o corrupto." };
  }
}

async function renderQrImageBase64(signedPayload) {
  return QRCode.toDataURL(signedPayload, { errorCorrectionLevel: "M", margin: 1, width: 300 });
}

module.exports = { generateQrToken, signQrPayload, verifyQrPayload, renderQrImageBase64 };
