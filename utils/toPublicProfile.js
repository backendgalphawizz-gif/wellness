/**
 * Strip sensitive fields from a Mongoose document or plain object for API responses.
 */
function toPublicProfile(doc) {
  if (!doc) {
    return null;
  }
  const o =
    typeof doc.toObject === "function"
      ? doc.toObject({ virtuals: false })
      : { ...doc };
  delete o.password;
  delete o.passwordHash;
  delete o.otp;
  delete o.otpExpire;
  delete o.resetPasswordToken;
  delete o.resetPasswordExpire;
  return o;
}

module.exports = { toPublicProfile };
