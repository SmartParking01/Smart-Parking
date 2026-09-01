const jwt = require("jsonwebtoken");

function signSessionToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });
}

function verifySessionToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signSessionToken, verifySessionToken };
