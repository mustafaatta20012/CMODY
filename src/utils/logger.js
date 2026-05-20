// src/utils/logger.js
const { createLogger, format, transports } = require("winston");
const path = require("path");

const { combine, timestamp, colorize, printf, json, errors } = format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

const logger = createLogger({
  level: process.env.NODE_ENV === "production" ? "warn" : "debug",
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" })
  ),
  transports: [
    // Console (development)
    new transports.Console({
      format: combine(colorize(), consoleFormat),
      silent: process.env.NODE_ENV === "test",
    }),
  ],
});

// Add file transport in production
if (process.env.NODE_ENV === "production") {
  logger.add(
    new transports.File({
      filename: path.join("logs", "error.log"),
      level: "error",
      format: json(),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );
  logger.add(
    new transports.File({
      filename: path.join("logs", "combined.log"),
      format: json(),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    })
  );
}

module.exports = { logger };
