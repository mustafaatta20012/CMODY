// src/config/database.js
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "info", "warn", "error"]
      : ["error"],
  errorFormat: "pretty",
});

// Soft shutdown helper
async function disconnectDB() {
  await prisma.$disconnect();
}

module.exports = { prisma, disconnectDB };
