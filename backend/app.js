import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import customerVehicleRoutes from './routes/customerVehicleRoutes.js';
import customerAppointmentRoutes from './routes/customerAppointmentRoutes.js';

export function createApp() {
  const app = express();
  const frontendOrigin = new URL(process.env.FRONTEND_URL || 'http://localhost:5173').origin;
  app.use(cors({ origin: frontendOrigin, credentials: true }));
  app.use((req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && req.headers.origin !== frontendOrigin) {
      return res.status(403).json({ message: 'Request origin is not allowed.' });
    }
    next();
  });
  app.use(express.json({ limit: '16kb' }));
  app.use('/api/auth', authRoutes);
  app.use('/api/vehicles', customerVehicleRoutes);
  app.use('/api/appointments', customerAppointmentRoutes);
  app.get('/', (req, res) => res.send('Vehicle Service & Repair Tracking System API is running...'));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status === 400 ? 400 : error.status === 413 ? 413 : 500;
    res.status(status).json({ message: status === 400 ? 'Invalid JSON request.' : status === 413 ? 'Request is too large.' : 'Unexpected server error.' });
  });
  return app;
}
