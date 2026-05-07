const {
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require("uuid");

const { docClient } = require("../config/db");

const TABLE = "StaticPage";
const STATUS = new Set(["active", "inactive"]);

function normalizeStatus(value, fallback = "active") {
  const next = String(value || fallback).toLowerCase().trim();
  return STATUS.has(next) ? next : fallback;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function withLegacyId(row) {
  if (!row) return null;
  return { ...row, _id: row.id };
}

async function getPageBySlug(slug) {
  const { Items } = await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: "SlugIndex",
    KeyConditionExpression: "slug = :slug",
    ExpressionAttributeValues: { ":slug": slug },
    Limit: 1,
  }));
  return withLegacyId(Items?.[0] || null);
}

async function listPages() {
  const rows = [];
  let lastKey;
  do {
    const { Items, LastEvaluatedKey } = await docClient.send(new ScanCommand({
      TableName: TABLE,
      ExclusiveStartKey: lastKey,
    }));
    if (Array.isArray(Items) && Items.length) rows.push(...Items);
    lastKey = LastEvaluatedKey;
  } while (lastKey);

  rows.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return rows.map(withLegacyId);
}

async function getPageById(id) {
  const { Item } = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { id },
  }));
  return withLegacyId(Item || null);
}

async function createPage({ title, content = "", status = "active", slug }) {
  const cleanTitle = String(title || "").trim();
  const now = new Date().toISOString();
  const cleanSlug = slugify(slug || cleanTitle);

  const existing = await getPageBySlug(cleanSlug);
  if (existing) {
    const err = new Error("slug already exists");
    err.code = "DUPLICATE_SLUG";
    throw err;
  }

  const item = {
    id: uuidv4(),
    title: cleanTitle,
    slug: cleanSlug,
    content: String(content || "").trim(),
    status: normalizeStatus(status),
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

async function updatePage(id, updates) {
  const existing = await getPageById(id);
  if (!existing) {
    const err = new Error("page not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  const next = { ...updates };

  if (next.slug !== undefined || next.title !== undefined) {
    const candidateSlug = slugify(next.slug || next.title || existing.slug);
    if (!candidateSlug) {
      const err = new Error("slug is required");
      err.code = "INVALID_SLUG";
      throw err;
    }
    if (candidateSlug !== existing.slug) {
      const slugRow = await getPageBySlug(candidateSlug);
      if (slugRow && slugRow.id !== id) {
        const err = new Error("slug already exists");
        err.code = "DUPLICATE_SLUG";
        throw err;
      }
    }
    next.slug = candidateSlug;
  }

  const entries = Object.entries(next).filter(([, value]) => value !== undefined);
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

async function deletePage(id) {
  await docClient.send(new DeleteCommand({
    TableName: TABLE,
    Key: { id },
    ConditionExpression: "attribute_exists(id)",
  }));
}

module.exports = {
  listPages,
  getPageById,
  createPage,
  updatePage,
  deletePage,
  slugify,
  normalizeStatus,
};
