const { PutCommand, GetCommand, UpdateCommand, DeleteCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const TABLE = "Admin";

function normalizeEmail(email) {
  return String(email || "").toLowerCase().trim();
}

async function getAdminKeyById(id) {
  const { Items } = await docClient.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "id = :id",
    ExpressionAttributeValues: { ":id": id },
    ScanIndexForward: false,
    Limit: 1,
  }));

  const item = Items?.[0] || null;
  if (!item) {
    return null;
  }

  return { id: item.id, createdAt: item.createdAt };
}

// CREATE admin
async function createAdmin({ name, email, password, phone = null, profileImage = null, status = "active" }) {
  const now = new Date().toISOString();

  const item = {
    id:                 uuidv4(),
    name:               name.trim(),
    email:              normalizeEmail(email),
    password,
    phone:              phone ? phone.trim() : null,
    profileImage:       profileImage ?? null,
    resetPasswordToken: null,
    resetPasswordExpire:null,
    status,                           
    createdAt:          now,
    updatedAt:          now,
  };

  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: item,
    ConditionExpression: "attribute_not_exists(id)",
  }));

  return item;
}

// GET admin by id
async function getAdminById(id) {
  const key = await getAdminKeyById(id);
  if (!key) return null;

  const { Item } = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: key,
  }));
  return Item || null;
}

// GET admin by email (uses GSI)
async function getAdminByEmail(email) {
  const { Items } = await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: "EmailIndex",
    KeyConditionExpression: "email = :email",
    ExpressionAttributeValues: { ":email": normalizeEmail(email) },
  }));
  return Items[0] || null;
}

// UPDATE admin fields
async function updateAdmin(id, updates) {
  if (!updates || typeof updates !== "object") {
    throw new Error("updates must be a non-null object");
  }

  const allowedUpdates = Object.entries(updates).filter(([, value]) => value !== undefined);
  if (allowedUpdates.length === 0) {
    throw new Error("No valid fields provided for update");
  }

  // Build SET expression dynamically from updates object
  const exprNames  = {};
  const exprValues = { ":updatedAt": new Date().toISOString() };
  let  setExpr    = "SET updatedAt = :updatedAt";

  for (const [key, val] of allowedUpdates) {
    const k = `#${key}`;
    const v = `:${key}`;
    exprNames[k]  = key;
    exprValues[v] = val;
    setExpr += `, ${k} = ${v}`;
  }

  const key = await getAdminKeyById(id);
  if (!key) {
    const err = new Error("Admin not found");
    err.name = "NotFoundError";
    throw err;
  }

  const { Attributes } = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: key,
    UpdateExpression: setExpr,
    ExpressionAttributeNames:  exprNames,
    ExpressionAttributeValues: exprValues,
    ConditionExpression: "attribute_exists(id) AND attribute_exists(createdAt)",
    ReturnValues: "ALL_NEW",
  }));

  return Attributes;
}

// SET reset password token
async function setResetToken(id, token, expireMs = 3600000) {
  return updateAdmin(id, {
    resetPasswordToken:  token,
    resetPasswordExpire: new Date(Date.now() + expireMs).toISOString(),
  });
}

// CLEAR reset password token after use
async function clearResetToken(id) {
  return updateAdmin(id, {
    resetPasswordToken:  null,
    resetPasswordExpire: null,
  });
}

// DELETE admin
async function deleteAdmin(id) {
  const key = await getAdminKeyById(id);
  if (!key) {
    const err = new Error("Admin not found");
    err.name = "NotFoundError";
    throw err;
  }

  await docClient.send(new DeleteCommand({
    TableName: TABLE,
    Key: key,
    ConditionExpression: "attribute_exists(id) AND attribute_exists(createdAt)",
  }));
  return { deleted: true };
}

module.exports = {
  createAdmin,
  getAdminById,
  getAdminByEmail,
  updateAdmin,
  setResetToken,
  clearResetToken,
  deleteAdmin,
};