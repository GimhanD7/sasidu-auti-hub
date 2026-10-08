import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { listBillableJobs, saveJobInvoice } from '../controllers/financeInvoiceController.js';

const router = express.Router();
router.use(requireAuth, requireRole('Finance', 'Admin'));
router.get('/jobs', listBillableJobs);
router.post('/jobs/:jobId/invoice', saveJobInvoice);

export default router;
