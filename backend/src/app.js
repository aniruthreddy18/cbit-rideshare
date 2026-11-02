import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import morgan from 'morgan';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env, isProduction } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import rideRoutes from './routes/rideRoutes.js';
import AppError from './utils/AppError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Built React app (created by `npm run build` in frontend/). Served when it exists.
const clientDist = path.resolve(__dirname, '../../frontend/dist');
const clientIndex = path.join(clientDist, 'index.html');
const serveClient = fs.existsSync(clientIndex);

const app = express();

app.disable('x-powered-by');
// Behind a hosting proxy (Render, Railway...) this makes req.ip / req.protocol correct,
// so the login rate limit applies per student instead of to everyone at once.
if (env.trustProxy) app.set('trust proxy', env.trustProxy);
app.use(helmet());
app.use(
  cors((req, callback) => {
    const origin = req.header('Origin');
    const sameOrigin = origin === `${req.protocol}://${req.get('host')}`;
    // No Origin (curl, Postman, the Vite proxy), same-site requests and whitelisted sites are allowed.
    if (!origin || sameOrigin || env.clientOrigins.includes(origin)) return callback(null, { origin: true });
    callback(new AppError(403, `Origin ${origin} is not allowed. Add it to CLIENT_ORIGIN in the backend environment.`));
  })
);
app.use(express.json({ limit: '20kb' }));
if (!isProduction) app.use(morgan('dev'));

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];
app.get('/api/health', (_req, res) => {
  const database = DB_STATES[mongoose.connection.readyState] || 'unknown';
  res.status(database === 'connected' ? 200 : 503).json({ success: database === 'connected', api: 'ok', database });
});

app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/bookings', bookingRoutes);

app.use('/api', notFound);

if (serveClient) {
  // Hashed assets (/assets/index-abc123.js) can be cached for a long time.
  app.use('/assets', express.static(path.join(clientDist, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(clientDist, { index: false }));
  // Any other GET (e.g. /my-rides after a refresh) gets the React app; React Router takes over.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile(clientIndex);
  });
}

app.use((req, res) => res.status(404).json({ success: false, message: `Not found: ${req.originalUrl}. The API lives under /api.` }));
app.use(errorHandler);

export default app;
