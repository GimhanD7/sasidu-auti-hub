// Wire HTTP paths to controller actions. Middleware order determines which session and role checks run before each handler.
import express from 'express';
import { listCustomerInvoices } from '../controllers/customerInvoiceController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('Customer'));
router.get('/', listCustomerInvoices);

export default router;
