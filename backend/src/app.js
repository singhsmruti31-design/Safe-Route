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

// Security Headers with Helmet
app.use(helmet());

// CORS Configuration with strict allowlist
const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser clients (curl, mobile, postman) or matching origins
    if (!origin || env.ALLOWED_ORIGINS.includes(origin) || env.ALLOWED_ORIGINS.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token']
};

app.use(cors(corsOptions));

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
