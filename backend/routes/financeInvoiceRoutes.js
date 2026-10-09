import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { deleteDraftInvoice, listBillableJobs, listFinanceInvoices, saveJobInvoice, sendFinanceInvoice, updateDraftInvoice } from '../controllers/financeInvoiceController.js';

const router = express.Router();
router.use(requireAuth, requireRole('Admin'));
router.get('/', listFinanceInvoices);
router.get('/jobs', listBillableJobs);
router.post('/jobs/:jobId/invoice', saveJobInvoice);
router.post('/:invoiceId/send', sendFinanceInvoice);
router.patch('/:invoiceId', updateDraftInvoice);
router.delete('/:invoiceId', deleteDraftInvoice);

export default router;
