import express from 'express';
import { listFinancePaymentHistory, listFinancePayments, reviewFinancePayment } from '../controllers/financePaymentController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('Admin'));
router.get('/', listFinancePayments);
router.get('/history', listFinancePaymentHistory);
router.patch('/:paymentId/review', reviewFinancePayment);

export default router;
