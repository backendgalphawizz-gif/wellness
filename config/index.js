require("dotenv").config();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtResetPasswordSecret: process.env.JWT_RESET_PASSWORD_SECRET,
  jwtVerifyEmailSecret: process.env.JWT_VERIFY_EMAIL_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  jwtResetPasswordExpiresIn: process.env.JWT_RESET_PASSWORD_EXPIRES_IN,
  jwtVerifyEmailExpiresIn: process.env.JWT_VERIFY_EMAIL_EXPIRES_IN,
  adminRegistrationEnabled: process.env.ADMIN_REGISTRATION_ENABLED === "true",
};