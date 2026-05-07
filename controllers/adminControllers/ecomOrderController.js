const Order = require("../../models/other/order");
const Product = require("../../models/other/product");
const AppError = require("../../utils/AppError");
const { asyncHandler } = require("../../utils/asyncHandler");
const { assertObjectId } = require("../../utils/assertObjectId");
const { getPagination, searchFilter } = require("../../utils/listQuery");

const ALLOWED_ORDER_STATUSES = new Set([
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);
const ALLOWED_PAYMENT_STATUSES = new Set(["pending", "paid", "failed", "refunded", "partially_refunded"]);
const ALLOWED_PAYMENT_METHODS = new Set(["cod", "online", "wallet"]);

function normalizeRequired(value) {
  return String(value ?? "").trim();
}

function normalizeOptional(value) {
  if (value === undefined || value === null) return undefined;
  return String(value).trim();
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asItems(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError("items must be a non-empty array", 400);
  }
  return value;
}

async function assertProductsExist(items) {
  const productIds = [...new Set(items.map((item) => String(item.product || "")).filter(Boolean))];
  for (const productId of productIds) assertObjectId(productId, "Invalid product id in items");
  const products = await Product.find({ _id: { $in: productIds } }).select("_id").lean();
  if (products.length !== productIds.length) {
    throw new AppError("One or more products do not exist", 404);
  }
}

function normalizeItems(items) {
  return items.map((item) => {
    const quantity = Number(item.quantity ?? 1);
    const unitPrice = Number(item.unitPrice ?? 0);
    const discountValue = Number(item.discountValue ?? 0);
    const taxValue = Number(item.taxValue ?? 0);
    const totalPrice = Number(item.totalPrice ?? 0);

    if (Number.isNaN(quantity) || quantity < 1) throw new AppError("Invalid item quantity", 400);
    if (Number.isNaN(unitPrice) || unitPrice < 0) throw new AppError("Invalid item unitPrice", 400);
    if (Number.isNaN(discountValue) || discountValue < 0) throw new AppError("Invalid item discountValue", 400);
    if (Number.isNaN(taxValue) || taxValue < 0) throw new AppError("Invalid item taxValue", 400);
    if (Number.isNaN(totalPrice) || totalPrice < 0) throw new AppError("Invalid item totalPrice", 400);

    return {
      product: normalizeRequired(item.product),
      name: normalizeRequired(item.name),
      sku: normalizeOptional(item.sku) || "",
      quantity,
      unitPrice,
      discountValue,
      taxValue,
      totalPrice,
    };
  });
}

function applyMutableFields(order, body) {
  if (Object.prototype.hasOwnProperty.call(body, "orderStatus")) {
    const orderStatus = normalizeRequired(body.orderStatus).toLowerCase();
    if (!ALLOWED_ORDER_STATUSES.has(orderStatus)) throw new AppError("Invalid orderStatus", 400);
    order.orderStatus = orderStatus;
  }
  if (Object.prototype.hasOwnProperty.call(body, "paymentStatus")) {
    const paymentStatus = normalizeRequired(body.paymentStatus).toLowerCase();
    if (!ALLOWED_PAYMENT_STATUSES.has(paymentStatus)) throw new AppError("Invalid paymentStatus", 400);
    order.paymentStatus = paymentStatus;
  }
  if (Object.prototype.hasOwnProperty.call(body, "paymentMethod")) {
    const paymentMethod = normalizeRequired(body.paymentMethod).toLowerCase();
    if (!ALLOWED_PAYMENT_METHODS.has(paymentMethod)) throw new AppError("Invalid paymentMethod", 400);
    order.paymentMethod = paymentMethod;
  }
  if (Object.prototype.hasOwnProperty.call(body, "notes")) {
    order.notes = normalizeOptional(body.notes) || "";
  }
  if (Object.prototype.hasOwnProperty.call(body, "addressSnapshot")) {
    order.addressSnapshot = asObject(body.addressSnapshot);
  }
}

exports.listOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { userId, orderStatus, paymentStatus, paymentMethod, search } = req.query;

  const filter = {};
  if (userId) {
    assertObjectId(userId, "Invalid userId filter");
    filter.user = userId;
  }
  if (orderStatus) {
    const value = normalizeRequired(orderStatus).toLowerCase();
    if (!ALLOWED_ORDER_STATUSES.has(value)) throw new AppError("Invalid orderStatus filter", 400);
    filter.orderStatus = value;
  }
  if (paymentStatus) {
    const value = normalizeRequired(paymentStatus).toLowerCase();
    if (!ALLOWED_PAYMENT_STATUSES.has(value)) throw new AppError("Invalid paymentStatus filter", 400);
    filter.paymentStatus = value;
  }
  if (paymentMethod) {
    const value = normalizeRequired(paymentMethod).toLowerCase();
    if (!ALLOWED_PAYMENT_METHODS.has(value)) throw new AppError("Invalid paymentMethod filter", 400);
    filter.paymentMethod = value;
  }

  const searchOr = searchFilter(search, ["orderNumber", "notes"]);
  if (searchOr) Object.assign(filter, searchOr);

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate("user", "name phone email")
      .populate("items.product", "name sku price thumbnail")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  res.json({
    orders,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
});

exports.getOrderById = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const order = await Order.findById(req.params.id)
    .populate("user", "name phone email")
    .populate("items.product", "name sku price thumbnail")
    .lean();
  if (!order) throw new AppError("Order not found", 404);
  res.json({ order });
});

exports.createOrder = asyncHandler(async (req, res) => {
  const orderNumber = normalizeRequired(req.body.orderNumber);
  const user = normalizeRequired(req.body.user);
  const items = normalizeItems(asItems(req.body.items));
  const subTotal = Number(req.body.subTotal ?? 0);
  const discountTotal = Number(req.body.discountTotal ?? 0);
  const taxTotal = Number(req.body.taxTotal ?? 0);
  const shippingCharge = Number(req.body.shippingCharge ?? 0);
  const grandTotal = Number(req.body.grandTotal ?? 0);
  const paymentMethod = (normalizeOptional(req.body.paymentMethod) || "cod").toLowerCase();
  const paymentStatus = (normalizeOptional(req.body.paymentStatus) || "pending").toLowerCase();
  const orderStatus = (normalizeOptional(req.body.orderStatus) || "pending").toLowerCase();
  const notes = normalizeOptional(req.body.notes) || "";
  const addressSnapshot = asObject(req.body.addressSnapshot);
  const placedAt = req.body.placedAt ? new Date(req.body.placedAt) : undefined;

  if (!orderNumber || !user) throw new AppError("orderNumber and user are required", 400);
  assertObjectId(user, "Invalid user id");
  await assertProductsExist(items);
  if (![subTotal, discountTotal, taxTotal, shippingCharge, grandTotal].every((v) => !Number.isNaN(v) && v >= 0)) {
    throw new AppError("Invalid order totals", 400);
  }
  if (!ALLOWED_PAYMENT_METHODS.has(paymentMethod)) throw new AppError("Invalid paymentMethod", 400);
  if (!ALLOWED_PAYMENT_STATUSES.has(paymentStatus)) throw new AppError("Invalid paymentStatus", 400);
  if (!ALLOWED_ORDER_STATUSES.has(orderStatus)) throw new AppError("Invalid orderStatus", 400);
  if (placedAt && Number.isNaN(placedAt.getTime())) throw new AppError("Invalid placedAt", 400);

  const order = await Order.create({
    orderNumber,
    user,
    items,
    subTotal,
    discountTotal,
    taxTotal,
    shippingCharge,
    grandTotal,
    paymentMethod,
    paymentStatus,
    orderStatus,
    notes,
    addressSnapshot,
    ...(placedAt ? { placedAt } : {}),
  });

  const fresh = await Order.findById(order._id)
    .populate("user", "name phone email")
    .populate("items.product", "name sku price thumbnail")
    .lean();
  res.status(201).json({ message: "Order created", order: fresh });
});

exports.updateOrder = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError("Order not found", 404);

  applyMutableFields(order, req.body);

  if (Object.prototype.hasOwnProperty.call(req.body, "items")) {
    const items = normalizeItems(asItems(req.body.items));
    await assertProductsExist(items);
    order.items = items;
  }

  const numericFields = ["subTotal", "discountTotal", "taxTotal", "shippingCharge", "grandTotal"];
  for (const field of numericFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      const value = Number(req.body[field]);
      if (Number.isNaN(value) || value < 0) throw new AppError(`Invalid ${field}`, 400);
      order[field] = value;
    }
  }

  await order.save();
  const fresh = await Order.findById(order._id)
    .populate("user", "name phone email")
    .populate("items.product", "name sku price thumbnail")
    .lean();
  res.json({ message: "Order updated", order: fresh });
});

exports.deleteOrder = asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const order = await Order.findByIdAndDelete(req.params.id).select("_id").lean();
  if (!order) throw new AppError("Order not found", 404);
  res.json({ message: "Order deleted" });
});
