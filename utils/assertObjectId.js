const mongoose = require("mongoose");
const AppError = require("./AppError");

function assertObjectId(id, message = "Invalid id") {
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw new AppError(message, 400);
  }
}

module.exports = { assertObjectId };
