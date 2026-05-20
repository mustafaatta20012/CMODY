// src/utils/ApiResponse.js
// All API responses follow this shape:
// { success, data, message, meta?, errors? }

class ApiResponse {
  static success(res, data = null, message = "Success", statusCode = 200, meta = null) {
    const body = { success: true, message, data };
    if (meta) body.meta = meta;
    return res.status(statusCode).json(body);
  }

  static created(res, data = null, message = "Created successfully") {
    return ApiResponse.success(res, data, message, 201);
  }

  static paginated(res, data, { page, limit, total }) {
    const totalPages = Math.ceil(total / limit);
    return ApiResponse.success(res, data, "Success", 200, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    });
  }

  static error(res, message = "Something went wrong", statusCode = 500, errors = null) {
    const body = { success: false, message };
    if (errors) body.errors = errors;
    return res.status(statusCode).json(body);
  }

  static notFound(res, resource = "Resource") {
    return ApiResponse.error(res, `${resource} not found`, 404);
  }

  static unauthorized(res, message = "Unauthorized") {
    return ApiResponse.error(res, message, 401);
  }

  static forbidden(res, message = "Forbidden") {
    return ApiResponse.error(res, message, 403);
  }

  static badRequest(res, message = "Bad request", errors = null) {
    return ApiResponse.error(res, message, 400, errors);
  }

  static conflict(res, message = "Already exists") {
    return ApiResponse.error(res, message, 409);
  }
}

// Custom error class for throwing inside controllers
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { ApiResponse, AppError };
