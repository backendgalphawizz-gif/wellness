const {
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require("uuid");

const { docClient } = require("../config/db");

const TABLE = "Transformation";
const STATUS = new Set(["active", "inactive"]);

function normalizeStatus(value, fallback = "active") {
  const next = String(value || fallback).trim().toLowerCase();
  return STATUS.has(next) ? next : fallback;
}

function withLegacyId(item) {
  if (!item) return null;
  return { ...item, _id: item.id };
}

async function createTransformation({ timeTaken, achievements, oldImage, newImage, description, status = "active", userId = null }) {
  const now = new Date().toISOString();
  const item = {
    id: uuidv4(),
    timeTaken: Number(timeTaken),
    achievements: String(achievements || "").trim(),
    oldImage: String(oldImage || "").trim(),
    newImage: String(newImage || "").trim(),
    description: String(description || "").trim(),
    status: normalizeStatus(status),
    createdAt: now,
    updatedAt: now,
  };

  const normalizedUserId = userId ? String(userId).trim() : "";
  if (normalizedUserId) {
    item.userId = normalizedUserId;
  }

  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: item,
    ConditionExpression: "attribute_not_exists(id)",
  }));

  return withLegacyId(item);
}

async function getTransformationById(id) {
  const { Item } = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { id },
  }));
  return withLegacyId(Item || null);
}

async function updateTransformation(id, updates) {
  const entries = Object.entries(updates || {}).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    throw new Error("No valid fields provided for update");
  }

  const exprNames = {};
  const exprValues = { ":updatedAt": new Date().toISOString() };
  const removeFields = [];
  let setExpr = "SET updatedAt = :updatedAt";

  for (const [key, value] of entries) {
    if (key === "userId" && (value === null || String(value).trim() === "")) {
      exprNames["#userId"] = "userId";
      removeFields.push("#userId");
      continue;
    }
    const n = `#${key}`;
    const v = `:${key}`;
    exprNames[n] = key;
    exprValues[v] = value;
    setExpr += `, ${n} = ${v}`;
  }

  const updateParts = [setExpr];
  if (removeFields.length > 0) {
    updateParts.push(`REMOVE ${removeFields.join(", ")}`);
  }

  const { Attributes } = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { id },
    UpdateExpression: updateParts.join(" "),
    ExpressionAttributeNames: exprNames,
    ExpressionAttributeValues: exprValues,
    ConditionExpression: "attribute_exists(id)",
    ReturnValues: "ALL_NEW",
  }));

  return withLegacyId(Attributes || null);
}

async function deleteTransformation(id) {
  await docClient.send(new DeleteCommand({
    TableName: TABLE,
    Key: { id },
    ConditionExpression: "attribute_exists(id)",
  }));
}

async function listTransformations({ page = 1, limit = 10, status, search, userId } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 10));
  const normalizedStatus = status ? normalizeStatus(status, "") : "";
  const normalizedSearch = String(search || "").trim().toLowerCase();
  const normalizedUserId = String(userId || "").trim();

  const filters = [];
  const exprNames = {};
  const exprValues = {};

  if (normalizedStatus) {
    filters.push("#status = :status");
    exprNames["#status"] = "status";
    exprValues[":status"] = normalizedStatus;
  }
  if (normalizedUserId) {
    filters.push("#userId = :userId");
    exprNames["#userId"] = "userId";
    exprValues[":userId"] = normalizedUserId;
  }
  if (normalizedSearch) {
    filters.push("(contains(#achievements, :search) OR contains(#description, :search))");
    exprNames["#achievements"] = "achievements";
    exprNames["#description"] = "description";
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

  rows.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / safeLimit));
  const start = (safePage - 1) * safeLimit;
  const transformations = rows.slice(start, start + safeLimit).map(withLegacyId);

  return {
    transformations,
    pagination: { page: safePage, limit: safeLimit, total, pages },
  };
}

module.exports = {
  createTransformation,
  getTransformationById,
  updateTransformation,
  deleteTransformation,
  listTransformations,
  normalizeStatus,
};
