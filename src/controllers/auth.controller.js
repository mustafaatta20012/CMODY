// src/controllers/auth.controller.js
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { prisma } = require("../config/database");
const jwt = require("jsonwebtoken");
const { ApiResponse, AppError } = require("../utils/ApiResponse");
const {
  generateAccessToken,
  generateRefreshToken,
  setAuthCookies,
  clearAuthCookies,
} = require("../middleware/auth.middleware");

// ── Register ─────────────────────────────────────
async function register(req, res) {
  const { email, password, firstName, lastName } = req.body;

  if (!email || !password || !firstName || !lastName) {
    return ApiResponse.badRequest(res, "All fields are required");
  }

  if (password.length < 8) {
    return ApiResponse.badRequest(res, "Password must be at least 8 characters");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return ApiResponse.conflict(res, "Email already registered");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      isVerified: process.env.NODE_ENV === "development", // auto-verify in dev
    },
    select: {
      id: true, email: true, firstName: true,
      lastName: true, role: true, createdAt: true,
    },
  });

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);
  setAuthCookies(res, accessToken, refreshToken);

  return ApiResponse.created(res, { user, accessToken }, "Account created successfully");
}

// ── Login ────────────────────────────────────────
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return ApiResponse.badRequest(res, "Email and password are required");
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Timing-safe comparison (prevent user enumeration)
  const dummyHash = "$2a$12$dummyhashfordummycomparison000000000000000000000000000";
  const isValid = user
    ? await bcrypt.compare(password, user.passwordHash || dummyHash)
    : await bcrypt.compare(password, dummyHash);

  if (!user || !isValid) {
    return ApiResponse.unauthorized(res, "Invalid email or password");
  }

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);
  setAuthCookies(res, accessToken, refreshToken);

  const safeUser = {
    id: user.id, email: user.email,
    firstName: user.firstName, lastName: user.lastName,
    role: user.role,
  };

  return ApiResponse.success(res, { user: safeUser, accessToken }, "Login successful");
}

// ── Logout ───────────────────────────────────────
async function logout(req, res) {
  clearAuthCookies(res);
  return ApiResponse.success(res, null, "Logged out successfully");
}

// ── Refresh Token ────────────────────────────────
async function refreshToken(req, res) {
  const token = req.cookies?.refresh_token;
  if (!token) return ApiResponse.unauthorized(res, "No refresh token");

  const jwt = require("jsonwebtoken");
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  if (decoded.type !== "refresh") {
    return ApiResponse.unauthorized(res, "Invalid token type");
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user) return ApiResponse.unauthorized(res, "User not found");

  const newAccessToken = generateAccessToken(user.id);
  const newRefreshToken = generateRefreshToken(user.id);
  setAuthCookies(res, newAccessToken, newRefreshToken);

  return ApiResponse.success(res, { accessToken: newAccessToken }, "Token refreshed");
}

// ── Get Me ───────────────────────────────────────
async function getMe(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      phone: true, role: true, avatarUrl: true, isVerified: true,
      createdAt: true,
      addresses: { where: { isDefault: true }, take: 1 },
      _count: { select: { orders: true } },
    },
  });
  return ApiResponse.success(res, user);
}

// ── Update Me ────────────────────────────────────
async function updateMe(req, res) {
  const { firstName, lastName, phone } = req.body;
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(phone !== undefined && { phone }),
    },
    select: { id: true, email: true, firstName: true, lastName: true, phone: true },
  });
  return ApiResponse.success(res, user, "Profile updated");
}

// ── Change Password ──────────────────────────────
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return ApiResponse.badRequest(res, "Valid current and new password (min 8 chars) required");
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!isValid) return ApiResponse.unauthorized(res, "Current password is incorrect");

  const newHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });

  return ApiResponse.success(res, null, "Password changed successfully");
}

// ── Forgot Password ──────────────────────────────
async function forgotPassword(req, res) {
  const { email } = req.body;
  if (!email) return ApiResponse.badRequest(res, "Email is required");

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success (don't reveal if email exists)
  if (!user) {
    return ApiResponse.success(res, null, "If that email exists, a reset link was sent");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordReset.create({ data: { userId: user.id, token, expiresAt } });

  // TODO: send email with reset link
  // await emailService.sendPasswordReset(user.email, token);

  return ApiResponse.success(res, null, "If that email exists, a reset link was sent");
}

// ── Reset Password ────────────────────────────────
async function resetPassword(req, res) {
  const { token } = req.params;
  const { password } = req.body;

  if (!password || password.length < 8) {
    return ApiResponse.badRequest(res, "Password must be at least 8 characters");
  }

  const reset = await prisma.passwordReset.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    return ApiResponse.badRequest(res, "Invalid or expired reset token");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
    prisma.passwordReset.update({ where: { token }, data: { usedAt: new Date() } }),
  ]);

  return ApiResponse.success(res, null, "Password reset successfully");
}

// ── Email Verification ────────────────────────────
async function verifyEmail(req, res) {
  // Placeholder — implement with signed URL or OTP
  return ApiResponse.success(res, null, "Email verified");
}

// ── Google OAuth ──────────────────────────────────
const axios = require("axios"); // أو fetch — شوف تحت

// ── Google OAuth Step 1: Redirect to Google ──────
function googleAuth(req, res) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_CALLBACK_URL,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account" // يخلي Google يعرض اختيار الحساب دايمًا
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

// ── Google OAuth Step 2: Handle Callback ─────────
async function googleCallback(req, res) {
  const { code, error } = req.query;

  // لو المستخدم رفض
  if (error || !code) {
    return res.redirect(
      `${process.env.CLIENT_URL}/auth.html?error=google_cancelled`
    );
  }

  try {
    // ── 1. استبدل الـ code بـ access_token من Google ──
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL,
        grant_type: "authorization_code"
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      throw new Error("Failed to get access token from Google");
    }

    // ── 2. جيب بيانات المستخدم من Google ──
    const userRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      }
    );

    const googleUser = await userRes.json();
    // googleUser = { id, email, name, given_name, family_name, picture, verified_email }

    if (!googleUser.email) {
      throw new Error("Could not retrieve email from Google");
    }

    // ── 3. ابحث عن المستخدم في الـ DB أو أنشئه ──
    let user = await prisma.user.findUnique({
      where: { email: googleUser.email }
    });

    if (!user) {
      // مستخدم جديد — أنشئه
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          firstName: googleUser.given_name || googleUser.name || "User",
          lastName: googleUser.family_name || "",
          googleId: googleUser.id,
          avatar: googleUser.picture || null,
          isVerified: true, // Google بيتحقق من الإيميل
          password: null // مفيش password لحسابات Google
        }
      });
    } else if (!user.googleId) {
      // حساب موجود بالإيميل ده — ربطه بـ Google
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: googleUser.id,
          avatar: googleUser.picture || user.avatar
        }
      });
    }

    // ── 4. أنشئ JWT بنفس طريقة الـ login العادي ──
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role || "user" },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ── 5. احفظ الـ refresh token في cookie آمنة ──
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 أيام
    });

    // ── 6. ابعت بيانات المستخدم للـ frontend ──
    // مش بنبعت الـ password أو الـ googleId
    const safeUser = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      createdAt: user.createdAt
    };

    // الـ token والـ user في الـ URL مؤقتاً — الـ frontend هيحذفهم فوراً
    const params2 = new URLSearchParams({
      token: accessToken,
      user: JSON.stringify(safeUser),
      provider: "google"
    });

    res.redirect(`${process.env.CLIENT_URL}/auth.html?${params2}`);
  } catch (err) {
    console.error("Google OAuth Error:", err.message);
    res.redirect(`${process.env.CLIENT_URL}/auth.html?error=google_failed`);
  }
}

module.exports = {
  register, login, logout, refreshToken,
  getMe, updateMe, changePassword,
  forgotPassword, resetPassword, verifyEmail,
  googleAuth, googleCallback,
};
