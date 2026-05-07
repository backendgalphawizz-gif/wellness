function getPagination(query) {
  const page = Math.max(1, parseInt(String(query.page || "1"), 10) || 1);
  const rawLimit = parseInt(String(query.limit || "10"), 10) || 10;
  const limit = Math.min(100, Math.max(1, rawLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function escapeRegex(s) {
  return String(s).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function searchFilter(search, fields) {
  if (!search || !String(search).trim()) {
    return null;
  }
  const rx = new RegExp(escapeRegex(search), "i");
  return { $or: fields.map((field) => ({ [field]: rx })) };
}

module.exports = { getPagination, searchFilter };
