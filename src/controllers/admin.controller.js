// src/controllers/admin.controller.js
const { prisma } = require("../config/database");
const { ApiResponse } = require("../utils/ApiResponse");

// ── Dashboard ────────────────────────────────────
async function getDashboard(req, res) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    totalProducts,
    totalOrders,
    totalCustomers,
    revenueAgg,
    lastMonthRevenue,
    recentOrders,
    ordersByStatus,
  ] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.order.count(),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.order.aggregate({
      where: { status: { in: ["PAID", "DELIVERED", "SHIPPED"] } },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: {
        status: { in: ["PAID", "DELIVERED", "SHIPPED"] },
        createdAt: { gte: startOfLastMonth, lt: startOfMonth },
      },
      _sum: { total: true },
    }),
    prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
  ]);

  // Sales by month (last 12 months)
  const salesByMonth = await prisma.$queryRaw`
    SELECT 
      TO_CHAR("createdAt", 'Mon') as month,
      EXTRACT(MONTH FROM "createdAt") as month_num,
      COALESCE(SUM(total), 0) as revenue
    FROM orders
    WHERE status IN ('PAID', 'DELIVERED', 'SHIPPED')
      AND "createdAt" >= NOW() - INTERVAL '12 months'
    GROUP BY month, month_num
    ORDER BY month_num ASC
  `;

  return ApiResponse.success(res, {
    stats: {
      totalProducts,
      totalOrders,
      totalCustomers,
      totalRevenue: Number(revenueAgg._sum.total || 0),
      lastMonthRevenue: Number(lastMonthRevenue._sum.total || 0),
    },
    recentOrders,
    ordersByStatus: Object.fromEntries(
      ordersByStatus.map((s) => [s.status, s._count.id])
    ),
    salesByMonth,
  });
}

// ── Users ────────────────────────────────────────
async function getUsers(req, res) {
  const { page = 1, limit = 20, search } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where, skip, take: parseInt(limit),
      orderBy: { createdAt: "desc" },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, isVerified: true, createdAt: true,
        _count: { select: { orders: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return ApiResponse.paginated(res, users, { page: parseInt(page), limit: parseInt(limit), total });
}

async function updateUserRole(req, res) {
  const { id } = req.params;
  const { role } = req.body;
  if (!["CUSTOMER", "ADMIN"].includes(role)) {
    return ApiResponse.badRequest(res, "Invalid role");
  }
  const user = await prisma.user.update({ where: { id }, data: { role } });
  return ApiResponse.success(res, { id: user.id, role: user.role }, "Role updated");
}

async function deleteUser(req, res) {
  const { id } = req.params;
  if (id === req.user.id) return ApiResponse.badRequest(res, "Cannot delete yourself");
  await prisma.user.delete({ where: { id } });
  return ApiResponse.success(res, null, "User deleted");
}

// ── Analytics ────────────────────────────────────
async function getAnalytics(req, res) {
  const topProducts = await prisma.orderItem.groupBy({
    by: ["productId", "productName"],
    _sum: { qty: true, totalPrice: true },
    orderBy: { _sum: { totalPrice: "desc" } },
    take: 5,
  });

  return ApiResponse.success(res, { topProducts });
}

// ── Audit Log ────────────────────────────────────
async function getAuditLog(req, res) {
  const { page = 1, limit = 50 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [logs, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip, take: parseInt(limit),
    }),
    prisma.auditLog.count(),
  ]);

  return ApiResponse.paginated(res, logs, { page: parseInt(page), limit: parseInt(limit), total });
}

// ── Coupons ───────────────────────────────────────
async function getCoupons(req, res) {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return ApiResponse.success(res, coupons);
}

async function createCoupon(req, res) {
  const { code, discountPercent, maxUses, minOrderValue, expiresAt } = req.body;
  const coupon = await prisma.coupon.create({
    data: {
      code: code.toUpperCase(),
      discountPercent: parseInt(discountPercent),
      maxUses: maxUses ? parseInt(maxUses) : null,
      minOrderValue: minOrderValue ? parseFloat(minOrderValue) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });
  return ApiResponse.created(res, coupon);
}

async function updateCoupon(req, res) {
  const { id } = req.params;
  const coupon = await prisma.coupon.update({ where: { id }, data: req.body });
  return ApiResponse.success(res, coupon);
}

async function deleteCoupon(req, res) {
  const { id } = req.params;
  await prisma.coupon.delete({ where: { id } });
  return ApiResponse.success(res, null, "Coupon deleted");
}

module.exports = {
  getDashboard, getUsers, updateUserRole, deleteUser,
  getAnalytics, getAuditLog,
  getCoupons, createCoupon, updateCoupon, deleteCoupon,
};
