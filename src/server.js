// src/server.js
// GODMODE STORE — Main Server Entry Point

require("dotenv").config();
require("express-async-errors");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const path = require("path");

const { logger } = require("./utils/logger");
const { errorHandler } = require("./middleware/errorHandler");
const { notFound } = require("./middleware/notFound");
const { connectRedis } = require("./config/redis");
const { prisma } = require("./config/database");

// ── Route Imports ────────────────────────────────
const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/product.routes");
const cartRoutes = require("./routes/cart.routes");
const orderRoutes = require("./routes/order.routes");
const chatRoutes = require("./routes/chat.routes");
const adminRoutes = require("./routes/admin.routes");
const uploadRoutes = require("./routes/upload.routes");
const webhookRoutes = require("./routes/webhook.routes");
const addressRoutes = require("./routes/address.routes"); // ✅ جديد

// ── App Init ─────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 4000;
const API_PREFIX = `/api/${process.env.API_VERSION || "v1"}`;

// ── Security ──────────────────────────────────────
app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS
app.use(
  cors({
    origin(origin, callback) {
      const allowed = [
        process.env.CLIENT_URL,
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5500",
        "http://127.0.0.1:3000",

        "http://localhost:5500"
      ].filter(Boolean);

      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ── Stripe Webhook (raw body BEFORE json parser) ──
app.use(
  `${API_PREFIX}/webhooks/stripe`,
  express.raw({ type: "application/json" }),
  webhookRoutes
);

// ── Body Parsing ──────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(compression());

// ── Logging ───────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(
    morgan("combined", {
      stream: { write: (msg) => logger.info(msg.trim()) },
    })
  );
}

// ── Global Rate Limiter ───────────────────────────
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests, please try again later." },
});
app.use(API_PREFIX, globalLimiter);

// ── Static Files ──────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use(express.static(path.join(__dirname, "../frontend"))); // Serve frontend files

// Fallback for root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/coffeNew.html"));
});

// ── Health Check ──────────────────────────────────
app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: "connected"
    });
  } catch (error) {
    console.error("Health check error:", error.message);
    res.status(503).json({
      status: "error",
      database: "disconnected",
      message: error.message
    });
  }
});

// ── API Routes ────────────────────────────────────
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/products`, productRoutes);
app.use(`${API_PREFIX}/cart`, cartRoutes);
app.use(`${API_PREFIX}/orders`, orderRoutes);
app.use(`${API_PREFIX}/chat`, chatRoutes);
app.use(`${API_PREFIX}/admin`, adminRoutes);
app.use(`${API_PREFIX}/upload`, uploadRoutes);
app.use(`${API_PREFIX}/addresses`, addressRoutes); // ✅ جديد

// ── 404 & Error Handlers ──────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Server Start ──────────────────────────────────
async function startServer() {
  try {
    await prisma.$connect();
    logger.info("✅ PostgreSQL connected");

    // await connectRedis();
    // logger.info("✅ Redis connected");

    if (!process.env.VERCEL) {
      app.listen(PORT, () => {
        logger.info(`🚀 GODMODE API running on port ${PORT}`);
        logger.info(`📍 API base: http://localhost:${PORT}${API_PREFIX}`);
        logger.info(`🏥 Health:   http://localhost:${PORT}/health`);
        logger.info(`🌍 Env: ${process.env.NODE_ENV}`);
      });
    } else {
      logger.info(`🚀 GODMODE API running in Vercel Serverless mode`);
    }
  } catch (error) {
    logger.error("❌ Failed to start server:", error);
    if (!process.env.VERCEL) process.exit(1);
  }
}

// ── Graceful Shutdown ─────────────────────────────
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

if (!process.env.VERCEL) {
  startServer();

  // ── Unhandled Promise Rejection Handler ────────────────────────
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
} else {
  // In Vercel, we export the app and let Vercel handle the initialization
  // Prisma will auto-connect on the first database query.
}

module.exports = app;
