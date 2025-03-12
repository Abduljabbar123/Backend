class ApiError extends Error {
  constructor(statusCode, message, errors = [], stack = "", status = "fail") {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.data = null;
    this.success = false;
    this.error = errors;

    if (stactck) {
      this.stack = statck;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
