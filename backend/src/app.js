import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import morgan from 'morgan';
import { env, isProduction } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import rideRoutes from './routes/rideRoutes.js';
import AppError from './utils/AppError.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin header (curl, Postman, the Vite proxy) are allowed.
      if (!origin || env.clientOrigins.includes(origin)) return callback(null, true);
      callback(new AppError(403, `Origin ${origin} is not allowed. Add it to CLIENT_ORIGIN in backend/.env.`));
    },
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
app.use((req, res) => res.status(404).json({ success: false, message: `Not found: ${req.originalUrl}. The API lives under /api.` }));
app.use(errorHandler);

export default app;
