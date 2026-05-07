const config = require("../config");

exports.errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  if (!err.statusCode && err.name === "MulterError") {
    statusCode = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
  }
  const payload = {
    status: err.status || false,
    message: err.message || "Internal Server Error",
  };

  if (config.nodeEnv === "development" && err.stack) {
    payload.stack = err.stack;
  }

  res.status(statusCode).json(payload);
};
