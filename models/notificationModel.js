const {
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require("uuid");

const { docClient } = require("../config/db");

const TABLE = "Notification";
const STATUS = new Set(["active", "inactive"]);
const AUDIENCE_TYPES = new Set(["users", "coaches"]);

function normalizeStatus(value, fallback = "active") {
  const next = String(value || fallback).trim().toLowerCase();
  return STATUS.has(next) ? next : fallback;
}

function normalizeAudienceType(value, fallback = "users") {
  const next = String(value || fallback).trim().toLowerCase();
  return AUDIENCE_TYPES.has(next) ? next : fallback;
}

function withLegacyId(item) {
  if (!item) return null;
  return { ...item, _id: item.id };
}

async function createNotification({ audienceType, message, image = "", status = "active" }) {
  const now = new Date().toISOString();
  const item = {
    id: uuidv4(),
    audienceType: normalizeAudienceType(audienceType),
    message: String(message || "").trim(),
    image: String(image || "").trim(),
    status: normalizeStatus(status),
    sentAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: item,
    ConditionExpression: "attribute_not_exists(id)",
  }));

  return withLegacyId(item);
}

async function getNotificationById(id) {
  const { Item } = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { id },
  }));
  return withLegacyId(Item || null);
}

async function updateNotification(id, updates) {
  const entries = Object.entries(updates || {}).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    throw new Error("No valid fields provided for update");
  }

  const exprNames = {};
  const exprValues = { ":updatedAt": new Date().toISOString() };
  let setExpr = "SET updatedAt = :updatedAt";

  for (const [key, value] of entries) {
    const n = `#${key}`;
    const v = `:${key}`;
    exprNames[n] = key;
    exprValues[v] = value;
    setExpr += `, ${n} = ${v}`;
  }

  const { Attributes } = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { id },
    UpdateExpression: setExpr,
    ExpressionAttributeNames: exprNames,
    ExpressionAttributeValues: exprValues,
    ConditionExpression: "attribute_exists(id)",
    ReturnValues: "ALL_NEW",
  }));

  return withLegacyId(Attributes || null);
}

async function deleteNotification(id) {
  await docClient.send(new DeleteCommand({
    TableName: TABLE,
    Key: { id },
    ConditionExpression: "attribute_exists(id)",
  }));
}

async function listNotifications({ page = 1, limit = 10, status, audienceType, search } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 10));
  const normalizedStatus = status ? normalizeStatus(status, "") : "";
  const normalizedAudience = audienceType ? normalizeAudienceType(audienceType, "") : "";
  const normalizedSearch = String(search || "").trim().toLowerCase();

  const filters = [];
  const exprNames = {};
  const exprValues = {};

  if (normalizedStatus) {
    filters.push("#status = :status");
    exprNames["#status"] = "status";
    exprValues[":status"] = normalizedStatus;
  }
  if (normalizedAudience) {
    filters.push("#audienceType = :audienceType");
    exprNames["#audienceType"] = "audienceType";
    exprValues[":audienceType"] = normalizedAudience;
  }
  if (normalizedSearch) {
    filters.push("contains(#message, :search)");
    exprNames["#message"] = "message";
    exprValues[":search"] = normalizedSearch;
  }

  const params = { TableName: TABLE };
  if (filters.length > 0) {
    params.FilterExpression = filters.join(" AND ");
    params.ExpressionAttributeNames = exprNames;
    params.ExpressionAttributeValues = exprValues;
  }

  const rows = [];
  let lastKey;
  do {
    const { Items, LastEvaluatedKey } = await docClient.send(new ScanCommand({
      ...params,
      ExclusiveStartKey: lastKey,
    }));
    if (Array.isArray(Items) && Items.length) rows.push(...Items);
    lastKey = LastEvaluatedKey;
  } while (lastKey);

  rows.sort((a, b) => String(b.sentAt || "").localeCompare(String(a.sentAt || "")));

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / safeLimit));
  const start = (safePage - 1) * safeLimit;
  const notifications = rows.slice(start, start + safeLimit).map(withLegacyId);

  return {
    notifications,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages,
    },
  };
}

module.exports = {
  createNotification,
  getNotificationById,
  updateNotification,
  deleteNotification,
  listNotifications,
  normalizeStatus,
  normalizeAudienceType,
};
