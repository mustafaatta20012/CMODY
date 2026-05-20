// src/middleware/auth.middleware.js
const jwt = require("jsonwebtoken");
const { prisma } = require("../config/database");
const { ApiResponse, AppError } = require("../utils/ApiResponse");

// ── Verify JWT ───────────────────────────────────
async function authenticate(req, res, next) {
  try {
    // Check Authorization header first, then cookie
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.cookies?.access_token) {
      token = req.cookies.access_token;
    }

    if (!token) {
      return ApiResponse.unauthorized(res, "Authentication required");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isVerified: true,
      },
    });

    if (!user) {
      return ApiResponse.unauthorized(res, "User not found");
    }

    req.user = user;
    next();
  } catch (err) {
    next(err); // passes to errorHandler (handles JWT errors)
  }
}

// ── Optional Auth (doesn't fail if no token) ─────
async function optionalAuth(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.cookies?.access_token) {
      token = req.cookies.access_token;
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, firstName: true, role: true },
      });
      req.user = user || null;
    } else {
      req.user = null;
    }
    next();
  } catch {
    req.user = null;
    next();
  }
}

// ── Role Guard ───────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return ApiResponse.unauthorized(res);
    }
    if (!roles.includes(req.user.role)) {
      return ApiResponse.forbidden(res, "Insufficient permissions");
    }
    next();
  };
}

// Shorthand guards
const requireAdmin = requireRole("ADMIN");
const requireCustomer = requireRole("CUSTOMER", "ADMIN");

// ── JWT helpers ──────────────────────────────────
function generateAccessToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

function generateRefreshToken(userId) {
  return jwt.sign({ userId, type: "refresh" }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  });
}

function setAuthCookies(res, accessToken, refreshToken) {
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: "/api/v1/auth/refresh",
  });
}

function clearAuthCookies(res) {
  res.clearCookie("access_token");
  res.clearCookie("refresh_token");
}

module.exports = {
  authenticate,
  optionalAuth,
  requireRole,
  requireAdmin,
  requireCustomer,
  generateAccessToken,
  generateRefreshToken,
  setAuthCookies,
  clearAuthCookies,
};
