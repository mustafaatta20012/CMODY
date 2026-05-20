// src/controllers/cart.controller.js
const { prisma } = require("../config/database");
const { ApiResponse } = require("../utils/ApiResponse");

// ── حساب الـ cart مع الخصم ──────────────────────
function calcTotals(items, discountPercent = 0) {
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.product.price) * item.qty,
    0
  );
  const shippingCost = subtotal === 0 ? 0 : subtotal >= 50 ? 0 : 5.99;
  const discountAmount = subtotal * (discountPercent / 100);
  const total = subtotal + shippingCost - discountAmount;

  return {
    subtotal: +subtotal.toFixed(2),
    shippingCost: +shippingCost.toFixed(2),
    discountAmount: +discountAmount.toFixed(2),
    total: +total.toFixed(2),
  };
}

// ── GET /cart ────────────────────────────────────
async function getCart(req, res) {
  const items = await prisma.cartItem.findMany({
    where: { userId: req.user.id },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          images: true,
          stock: true,
          isActive: true,
          badge: true,
          category: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // فلتر المنتجات الغير متاحة
  const activeItems = items.filter((i) => i.product.isActive);

  const totals = calcTotals(activeItems);

  return ApiResponse.success(res, {
    items: activeItems,
    ...totals,
    itemCount: activeItems.reduce((s, i) => s + i.qty, 0),
  });
}

// ── POST /cart  (add or update) ──────────────────
async function addItem(req, res) {
  const { productId, qty = 1, options = {} } = req.body;

  if (!productId) return ApiResponse.badRequest(res, "productId is required");

  const parsedQty = parseInt(qty);
  if (isNaN(parsedQty) || parsedQty < 1) {
    return ApiResponse.badRequest(res, "qty must be a positive integer");
  }

  // تحقق أن المنتج موجود ومتاح
  const product = await prisma.product.findUnique({
    where: { id: productId, isActive: true },
  });

  if (!product) return ApiResponse.notFound(res, "Product");

  if (product.stock < parsedQty) {
    return ApiResponse.badRequest(
      res,
      `Only ${product.stock} items in stock`
    );
  }

  // upsert — إذا موجود يحدّث الكمية، وإلا يضيف
  const cartItem = await prisma.cartItem.upsert({
    where: {
      userId_productId: {
        userId: req.user.id,
        productId,
      },
    },
    update: {
      qty: { increment: parsedQty },
      options,
    },
    create: {
      userId: req.user.id,
      productId,
      qty: parsedQty,
      options,
    },
    include: {
      product: {
        select: { id: true, name: true, price: true, images: true, stock: true },
      },
    },
  });

  // تحقق الكمية الإجمالية لا تتجاوز المخزون
  if (cartItem.qty > product.stock) {
    await prisma.cartItem.update({
      where: { id: cartItem.id },
      data: { qty: product.stock },
    });
    return ApiResponse.success(
      res,
      cartItem,
      `Quantity adjusted to available stock (${product.stock})`
    );
  }

  return ApiResponse.success(res, cartItem, "Item added to cart");
}

// ── PATCH /cart/:productId ───────────────────────
async function updateQty(req, res) {
  const { productId } = req.params;
  const { qty } = req.body;

  const parsedQty = parseInt(qty);
  if (isNaN(parsedQty) || parsedQty < 1) {
    return ApiResponse.badRequest(res, "qty must be a positive integer");
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { stock: true, isActive: true },
  });

  if (!product || !product.isActive) {
    return ApiResponse.notFound(res, "Product");
  }

  if (parsedQty > product.stock) {
    return ApiResponse.badRequest(res, `Only ${product.stock} items in stock`);
  }

  const cartItem = await prisma.cartItem.update({
    where: {
      userId_productId: { userId: req.user.id, productId },
    },
    data: { qty: parsedQty },
    include: {
      product: { select: { id: true, name: true, price: true, images: true } },
    },
  });

  return ApiResponse.success(res, cartItem, "Quantity updated");
}

// ── DELETE /cart/:productId ──────────────────────
async function removeItem(req, res) {
  const { productId } = req.params;

  await prisma.cartItem.delete({
    where: {
      userId_productId: { userId: req.user.id, productId },
    },
  });

  return ApiResponse.success(res, null, "Item removed from cart");
}

// ── DELETE /cart ─────────────────────────────────
async function clearCart(req, res) {
  await prisma.cartItem.deleteMany({
    where: { userId: req.user.id },
  });

  return ApiResponse.success(res, null, "Cart cleared");
}

// ── POST /cart/coupon ────────────────────────────
async function applyCoupon(req, res) {
  const { code } = req.body;
  if (!code) return ApiResponse.badRequest(res, "Coupon code is required");

  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (!coupon || !coupon.isActive) {
    return ApiResponse.badRequest(res, "Invalid or inactive coupon code");
  }

  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    return ApiResponse.badRequest(res, "Coupon has expired");
  }

  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    return ApiResponse.badRequest(res, "Coupon usage limit reached");
  }

  // تحقق الحد الأدنى للطلب
  if (coupon.minOrderValue) {
    const items = await prisma.cartItem.findMany({
      where: { userId: req.user.id },
      include: { product: { select: { price: true } } },
    });

    const subtotal = items.reduce(
      (s, i) => s + Number(i.product.price) * i.qty,
      0
    );

    if (subtotal < Number(coupon.minOrderValue)) {
      return ApiResponse.badRequest(
        res,
        `Minimum order value is $${coupon.minOrderValue} for this coupon`
      );
    }
  }

  return ApiResponse.success(res, {
    code: coupon.code,
    discountPercent: coupon.discountPercent,
    minOrderValue: coupon.minOrderValue,
  }, "Coupon applied successfully");
}

// ── DELETE /cart/coupon ──────────────────────────
async function removeCoupon(req, res) {
  // الـ coupon مش محفوظ في الـ cart — بس نرد success
  return ApiResponse.success(res, null, "Coupon removed");
}

module.exports = {
  getCart,
  addItem,
  updateQty,
  removeItem,
  clearCart,
  applyCoupon,
  removeCoupon,
};
