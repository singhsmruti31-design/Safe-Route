import rateLimit from 'express-rate-limit';

// Global API rate limiter: 60 requests per minute per IP
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again after a minute.'
  }
});

// Rate limiter for authentication attempts (login, signup, password reset): 25 per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts from this IP. Please try again in 15 minutes.'
  }
});

// Tighter rate limiter for community reports submission: 10 per hour per IP
export const reportsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Report submission rate limit reached. Please wait before submitting more reports.'
  }
});
