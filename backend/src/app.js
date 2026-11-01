import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
import contactsRouter from './routes/contacts.js';
import savedRoutesRouter from './routes/savedRoutes.js';
import placesRouter from './routes/places.js';
import routesRouter from './routes/routes.js';
import safeSpotsRouter from './routes/safeSpots.js';
import sosRouter from './routes/sos.js';
import reportsRouter from './routes/reports.js';
import adminRouter from './routes/admin.js';

const app = express();

// Security Headers with Helmet — allow cross-origin resource sharing
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS Configuration with robust origin validation and preflight support
const isOriginAllowed = (origin) => {
  // Allow non-browser clients (curl, mobile apps, postman, Render internal health probes)
  if (!origin) return true;

  const cleanOrigin = origin.trim().replace(/\/+$/, '').toLowerCase();

  // Wildcard allowed
  if (env.ALLOWED_ORIGINS.includes('*')) return true;

  // Direct match against ALLOWED_ORIGINS (env list + default list)
  const matchesDirect = env.ALLOWED_ORIGINS.some(allowed => {
    return allowed.trim().replace(/\/+$/, '').toLowerCase() === cleanOrigin;
  });
  if (matchesDirect) return true;

  // Allow production and preview deployments for this project on Vercel
  if (/^https:\/\/safe-route(-[a-z0-9-]+)?\.vercel\.app$/.test(cleanOrigin)) {
    return true;
  }

  // Allow localhost & loopback for development on any port
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin)) {
    return true;
  }

  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Rejected request from origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-admin-token',
    'Accept',
    'Origin',
    'X-Requested-With'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400,
  optionsSuccessStatus: 204
};

// Apply CORS to all requests
app.use(cors(corsOptions));

// Explicitly handle preflight OPTIONS requests across all routes
app.options('*', cors(corsOptions));

// Body parser (100kb limit)
app.use(express.json({ limit: '100kb' }));

// Apply Global Rate Limiting
app.use(globalLimiter);

// Safe request logging (NEVER log exact coordinates or credentials)
app.use((req, res, next) => {
  const sanitizedPath = req.path;
  const method = req.method;
  console.log(`[REQ] ${method} ${sanitizedPath} - IP: ${req.ip}`);
  next();
});

// API Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/saved-routes', savedRoutesRouter);
app.use('/api/places', placesRouter);
app.use('/api/routes', routesRouter);
app.use('/api/safe-spots', safeSpotsRouter);
app.use('/api/sos', sosRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/admin', adminRouter);

// 404 Handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Central Error Handler
app.use(errorHandler);

export default app;
