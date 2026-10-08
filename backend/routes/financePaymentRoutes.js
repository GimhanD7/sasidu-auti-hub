import express from 'express';
import { listFinancePaymentHistory, listFinancePayments, listOutstandingInvoices, listPayableInvoices, recordFinancePayment, reviewFinancePayment, sendPaymentReminder } from '../controllers/financePaymentController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('Finance', 'Admin'));
router.get('/', listFinancePayments);
router.get('/history', listFinancePaymentHistory);
router.get('/outstanding', listOutstandingInvoices);
router.get('/payable-invoices', listPayableInvoices);
router.post('/record', recordFinancePayment);
router.post('/:invoiceId/reminder', sendPaymentReminder);
router.patch('/:paymentId/review', reviewFinancePayment);

export default router;
