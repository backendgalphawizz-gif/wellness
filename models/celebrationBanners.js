const {
    PutCommand,
    GetCommand,
    UpdateCommand,
    DeleteCommand,
    ScanCommand,
  } = require("@aws-sdk/lib-dynamodb");
  const { v4: uuidv4 } = require("uuid");
  const { docClient } = require("../config/db");
  
  const TABLE = "CelebrationBanners";
  const STATUS = new Set(["active", "inactive"]);
  const TYPE = new Set(["birthday","championship"]);
  
  function normalizeStatus(value, fallback = "active") {
    const next = String(value || fallback).toLowerCase().trim();
    return STATUS.has(next) ? next : fallback;
  }
  
  function normalizeType(value, fallback = "birthday") {
    const next = String(value || fallback).toLowerCase().trim();
    return TYPE.has(next) ? next : fallback;
  }
  
  function withLegacyId(item) {
    if (!item) return null;
    return { ...item, _id: item.id };
  }

function sanitizeUpdateField(key, value) {
  if (key === "status") return normalizeStatus(value);
  if (key === "type") return normalizeType(value);
  if (["title", "image", "startDate", "endDate"].includes(key)) return String(value).trim();
  return value;
}
  
  async function createCelebrationBanner({ title, image, type = "birthday", status = "active" , startDate, endDate}) {
    const now = new Date().toISOString();
    const item = {
      id: uuidv4(),
      title: String(title || "").trim(),
      type: normalizeType(type),
      image: String(image || "").trim(),
      status: normalizeStatus(status),
      startDate: String(startDate || "").trim(),
      endDate: String(endDate || "").trim(),
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
  
  async function getCelebrationBannerById(id) {
    const { Item } = await docClient.send(new GetCommand({
      TableName: TABLE,
      Key: { id },
    }));
    return withLegacyId(Item || null);
  }
  
  async function updateCelebrationBanner(id, updates) {
  const blockedFields = new Set(["id", "_id", "createdAt"]);
  const entries = Object.entries(updates || {})
    .filter(([k, v]) => !blockedFields.has(k) && v !== undefined)
    .map(([k, v]) => [k, sanitizeUpdateField(k, v)]);

    if (entries.length === 0) throw new Error("No valid fields provided for update");
  
    const exprNames = {};
    const exprValues = { ":updatedAt": new Date().toISOString() };
    let setExpr = "SET updatedAt = :updatedAt";
  
    for (const [k, v] of entries) {
      exprNames[`#${k}`] = k;
      exprValues[`:${k}`] = v;
      setExpr += `, #${k} = :${k}`;
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
  
  async function deleteCelebrationBanner(id) {
    await docClient.send(new DeleteCommand({
      TableName: TABLE,
      Key: { id },
      ConditionExpression: "attribute_exists(id)",
    }));
  }
  
  async function listCelebrationBanners({ page = 1, limit = 10, status, type, search } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 10));
    const normalizedStatus = status ? normalizeStatus(status, "") : "";
    const normalizedType = type ? normalizeType(type, "") : "";
    const normalizedSearch = String(search || "").trim().toLowerCase();
  
    const filters = [];
    const names = {};
    const values = {};
  
    if (normalizedStatus) {
      filters.push("#status = :status");
      names["#status"] = "status";
      values[":status"] = normalizedStatus;
    }
    if (normalizedType) {
      filters.push("#type = :type");
      names["#type"] = "type";
      values[":type"] = normalizedType;
    }
    if (normalizedSearch) {
    filters.push("contains(#title, :search)");
    names["#title"] = "title";
      values[":search"] = normalizedSearch;
    }
  
    const params = { TableName: TABLE };
    if (filters.length > 0) {
      params.FilterExpression = filters.join(" AND ");
      params.ExpressionAttributeNames = names;
      params.ExpressionAttributeValues = values;
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
    const celebrationBanners = rows.slice(start, start + safeLimit).map(withLegacyId);
  
    return {
      celebrationBanners,
      pagination: { page: safePage, limit: safeLimit, total, pages },
    };
  }
  
  module.exports = {
    createCelebrationBanner,
    getCelebrationBannerById,
    updateCelebrationBanner,
    deleteCelebrationBanner,
    listCelebrationBanners,
  };
  