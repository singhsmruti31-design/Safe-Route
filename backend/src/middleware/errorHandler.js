import { ZodError } from 'zod';

/**
 * Central Error Handling Middleware
 * - Formats Zod validation errors to clean 400 responses
 * - Catches uncaught application errors without leaking stack traces or credentials
 */
export function errorHandler(err, req, res, next) {
  // If response headers have already been sent, delegate to default express handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
      code: e.code
    }));

    return res.status(400).json({
      error: 'Validation failed',
      details: formattedErrors
    });
  }

  // Handle standard HTTP errors with status codes
  const status = err.status || err.statusCode || 500;
  
  // Safe error message (avoid exposing SQL details, file paths, or env secrets)
  let safeMessage = err.message || 'Internal server error';
  if (status === 500 && process.env.NODE_ENV === 'production') {
    safeMessage = 'An unexpected internal error occurred';
  }

  // Log error server-side for debugging (sanitized)
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message);

  return res.status(status).json({
    error: safeMessage
  });
}
