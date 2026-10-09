import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import customerVehicleRoutes from './routes/customerVehicleRoutes.js';
import customerAppointmentRoutes from './routes/customerAppointmentRoutes.js';

import customerInvoiceRoutes from './routes/customerInvoiceRoutes.js';
import customerPaymentRoutes from './routes/customerPaymentRoutes.js';
import financePaymentRoutes from './routes/financePaymentRoutes.js';

import financeInvoiceRoutes from './routes/financeInvoiceRoutes.js';
import adminDashboardRoutes from './routes/adminDashboardRoutes.js';

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
  app.use('/api/auth/technician/jobs', (req, res, next) => {
    if (req.method === 'POST' && /\/photos$/.test(req.path)) return express.json({ limit: '2mb' })(req, res, next);
    next();
  });
  app.use((req, res, next) => {
    if (['POST', 'PATCH'].includes(req.method) && /^\/api\/(?:admin\/)?vehicles(?:\/[^/]+)?$/.test(req.path)) return express.json({ limit: '2mb' })(req, res, next);
    next();
  });
  app.use(express.json({ limit: '16kb' }));
  app.use('/api/auth', authRoutes);
  app.use('/api/vehicles', customerVehicleRoutes);
  app.use('/api/appointments', customerAppointmentRoutes);

  app.use('/api/customer-invoices', customerInvoiceRoutes);
  app.use('/api/customer-payments', customerPaymentRoutes);
  app.use('/api/admin/payments', financePaymentRoutes);
  app.use('/api/admin/invoices', financeInvoiceRoutes);
  app.use('/api/finance/invoices', financeInvoiceRoutes);
  app.use('/api/admin', adminDashboardRoutes);
  app.get('/', (req, res) => res.send('Vehicle Service & Repair Tracking System API is running...'));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status === 400 ? 400 : error.status === 413 ? 413 : 500;
    res.status(status).json({ message: status === 400 ? 'Invalid JSON request.' : status === 413 ? 'Request is too large.' : 'Unexpected server error.' });
  });
  return app;
}
