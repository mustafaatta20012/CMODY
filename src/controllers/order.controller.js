// src/controllers/order.controller.js
const { prisma } = require("../config/database");
const { ApiResponse, AppError } = require("../utils/ApiResponse");
const { logger } = require("../utils/logger");

// lazy-load Stripe — لا يكسر السيرفر إذا STRIPE_SECRET_KEY مش موجود
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new AppError("Stripe is not configured", 503);
  }
  return require("stripe")(process.env.STRIPE_SECRET_KEY);
}

// ── توليد رقم الطلب ─────────────────────────────
async function generateOrderNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.order.count();
  return `GM-${year}-${String(count + 1).padStart(4, "0")}`;
}

// ── حساب إجماليات السلة ─────────────────────────
function calcTotals(items, discountPercent = 0) {
  const subtotal = items.reduce(
    (s, i) => s + Number(i.product.price) * i.qty,
    0
  );
  const shippingCost = subtotal >= 50 ? 0 : 5.99;
  const discountAmount = subtotal * (discountPercent / 100);
  const total = subtotal + shippingCost - discountAmount;

  return {
    subtotal: +subtotal.toFixed(2),
    shippingCost: +shippingCost.toFixed(2),
    discountAmount: +discountAmount.toFixed(2),
    total: +total.toFixed(2),
  };
}

// ── POST /orders  (checkout) ─────────────────────
async function createOrder(req, res) {
  const {
    addressId,
    paymentMethod = "CARD",
    couponCode,
    notes,
    // Shipping manual (إذا ما في address محفوظ)
    shippingName,
    shippingStreet,
    shippingCity,
    shippingZip,
    shippingCountry = "US",
  } = req.body;

  // جلب سلة المستخدم
  const cartItems = await prisma.cartItem.findMany({
    where: { userId: req.user.id },
    include: {
      product: {
        select: {
          id: true, name: true, price: true,
          stock: true, isActive: true,
        },
      },
    },
  });

  if (!cartItems.length) {
    return ApiResponse.badRequest(res, "Your cart is empty");
  }

  // تحقق توفر المنتجات
  for (const item of cartItems) {
    if (!item.product.isActive) {
      return ApiResponse.badRequest(
        res,
        `Product "${item.product.name}" is no longer available`
      );
    }
    if (item.product.stock < item.qty) {
      return ApiResponse.badRequest(
        res,
        `Insufficient stock for "${item.product.name}". Available: ${item.product.stock}`
      );
    }
  }

  // تحقق وتحميل الكوبون
  let coupon = null;
  let discountPercent = 0;

  if (couponCode) {
    coupon = await prisma.coupon.findUnique({
      where: { code: couponCode.toUpperCase() },
    });

    if (!coupon || !coupon.isActive) {
      return ApiResponse.badRequest(res, "Invalid coupon code");
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return ApiResponse.badRequest(res, "Coupon has expired");
    }
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return ApiResponse.badRequest(res, "Coupon usage limit reached");
    }
    discountPercent = coupon.discountPercent;
  }

  // تحقق العنوان
  let address = null;
  if (addressId) {
    address = await prisma.address.findUnique({
      where: { id: addressId, userId: req.user.id },
    });
    if (!address) return ApiResponse.notFound(res, "Address");
  }

  const { subtotal, shippingCost, discountAmount, total } = calcTotals(
    cartItems,
    discountPercent
  );

  // تحقق الحد الأدنى للكوبون
  if (coupon?.minOrderValue && subtotal < Number(coupon.minOrderValue)) {
    return ApiResponse.badRequest(
      res,
      `Minimum order value is $${coupon.minOrderValue} for this coupon`
    );
  }

  const orderNumber = await generateOrderNumber();

  // إنشاء الطلب في transaction
  const order = await prisma.$transaction(async (tx) => {
    // إنشاء الطلب
    const newOrder = await tx.order.create({
      data: {
        orderNumber,
        userId: req.user.id,
        addressId: address?.id || null,
        status: "PENDING",
        paymentMethod: paymentMethod.toUpperCase(),
        subtotal,
        shippingCost,
        discountAmount,
        total,
        couponId: coupon?.id || null,
        notes: notes || null,

        // snapshot العنوان
        shippingName: address?.fullName || shippingName || null,
        shippingStreet: address?.street || shippingStreet || null,
        shippingCity: address?.city || shippingCity || null,
        shippingZip: address?.zip || shippingZip || null,
        shippingCountry: address?.country || shippingCountry,

        // إضافة items كـ snapshot
        items: {
          create: cartItems.map((item) => ({
            productId: item.productId,
            productName: item.product.name,
            qty: item.qty,
            unitPrice: Number(item.product.price),
            totalPrice: +(Number(item.product.price) * item.qty).toFixed(2),
            options: item.options || {},
          })),
        },
      },
      include: { items: true },
    });

    // خصم المخزون
    for (const item of cartItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.qty } },
      });
    }

    // تحديث عداد الكوبون
    if (coupon) {
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } },
      });
    }

    // مسح السلة
    await tx.cartItem.deleteMany({ where: { userId: req.user.id } });

    // Audit log
    await tx.auditLog.create({
      data: {
        userId: req.user.id,
        action: "order.created",
        entity: "Order",
        entityId: newOrder.id,
        metadata: { orderNumber, total },
        ip: req.ip,
      },
    });

    return newOrder;
  });

  logger.info(`✅ Order created: ${orderNumber} for user ${req.user.id}`);

  return ApiResponse.created(res, order, "Order placed successfully");
}

// ── POST /orders/payment-intent (Stripe) ─────────
async function createPaymentIntent(req, res) {
  const stripe = getStripe();
  const { amount, currency = "usd", orderId } = req.body;

  if (!amount || amount < 50) {
    return ApiResponse.badRequest(res, "Amount must be at least $0.50");
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // cents
    currency,
    metadata: {
      orderId: orderId || "",
      userId: req.user.id,
    },
    automatic_payment_methods: { enabled: true },
  });

  // ربط الـ paymentIntent بالطلب إذا تم تمرير orderId
  if (orderId) {
    await prisma.order.update({
      where: { id: orderId, userId: req.user.id },
      data: { paymentIntentId: paymentIntent.id },
    });
  }

  return ApiResponse.success(res, {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  });
}

// ── GET /orders/my ───────────────────────────────
async function getMyOrders(req, res) {
  const { page = 1, limit = 10 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: parseInt(limit),
      include: {
        items: {
          select: {
            id: true,
            productName: true,
            qty: true,
            unitPrice: true,
            totalPrice: true,
          },
        },
        address: true,
      },
    }),
    prisma.order.count({ where: { userId: req.user.id } }),
  ]);

  return ApiResponse.paginated(res, orders, {
    page: parseInt(page),
    limit: parseInt(limit),
    total,
  });
}

// ── GET /orders/my/:id ───────────────────────────
async function getMyOrder(req, res) {
  const { id } = req.params;

  const order = await prisma.order.findUnique({
    where: { id, userId: req.user.id },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, slug: true, images: true },
          },
        },
      },
      address: true,
      coupon: { select: { code: true, discountPercent: true } },
    },
  });

  if (!order) return ApiResponse.notFound(res, "Order");

  return ApiResponse.success(res, order);
}

// ── GET /orders  (Admin) ─────────────────────────
async function getAll(req, res) {
  const { page = 1, limit = 20, status, userId } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {};
  if (status) where.status = status.toUpperCase();
  if (userId) where.userId = userId;

  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: parseInt(limit),
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        items: { select: { productName: true, qty: true, totalPrice: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return ApiResponse.paginated(res, orders, {
    page: parseInt(page),
    limit: parseInt(limit),
    total,
  });
}

// ── GET /orders/:id  (Admin) ─────────────────────
async function getOne(req, res) {
  const { id } = req.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, email: true, firstName: true, lastName: true, phone: true },
      },
      items: {
        include: {
          product: { select: { id: true, slug: true, images: true } },
        },
      },
      address: true,
      coupon: { select: { code: true, discountPercent: true } },
    },
  });

  if (!order) return ApiResponse.notFound(res, "Order");

  return ApiResponse.success(res, order);
}

// ── PATCH /orders/:id/status  (Admin) ────────────
async function updateStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = [
    "PENDING", "PAID", "PROCESSING",
    "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED",
  ];

  if (!validStatuses.includes(status?.toUpperCase())) {
    return ApiResponse.badRequest(res, `Invalid status. Valid: ${validStatuses.join(", ")}`);
  }

  const order = await prisma.order.update({
    where: { id },
    data: {
      status: status.toUpperCase(),
      ...(status.toUpperCase() === "PAID" && { paidAt: new Date() }),
    },
    select: { id: true, orderNumber: true, status: true, updatedAt: true },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: `order.${status.toLowerCase()}`,
      entity: "Order",
      entityId: id,
      metadata: { newStatus: status.toUpperCase() },
      ip: req.ip,
    },
  });

  logger.info(`📦 Order ${order.orderNumber} status → ${status.toUpperCase()}`);

  return ApiResponse.success(res, order, `Order status updated to ${status}`);
}

module.exports = {
  createOrder,
  createPaymentIntent,
  getMyOrders,
  getMyOrder,
  getAll,
  getOne,
  updateStatus,
};
