class AppError extends Error {
  constructor(message, statusCode = 400, status = false) {
    super(message);
    this.statusCode = statusCode;
    this.status = status;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
