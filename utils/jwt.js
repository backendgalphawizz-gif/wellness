const jwt = require("jsonwebtoken");
const config = require("../config");

function getAccessSecret() {
  if (!config.jwtSecret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return config.jwtSecret;
}

function getRefreshSecret() {
  if (!config.jwtRefreshSecret) {
    throw new Error("JWT_REFRESH_SECRET is not configured");
  }
  return config.jwtRefreshSecret;
}

exports.signAccessToken = (payload) =>
  jwt.sign(payload, getAccessSecret(), {
    expiresIn: config.jwtExpiresIn || "1d",
  });

exports.verifyAccessToken = (token) => jwt.verify(token, getAccessSecret());

exports.signRefreshToken = (payload) =>
  jwt.sign(payload, getRefreshSecret(), {
    expiresIn: config.jwtRefreshExpiresIn || "7d",
  });

exports.verifyRefreshToken = (token) =>
  jwt.verify(token, getRefreshSecret());

exports.createTokenPair = (payload) => ({
  accessToken: exports.signAccessToken(payload),
  refreshToken: exports.signRefreshToken(payload),
});
