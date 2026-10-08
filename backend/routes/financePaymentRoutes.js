import express from 'express';
import { listFinancePayments, reviewFinancePayment } from '../controllers/financePaymentController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('Finance', 'Admin'));
router.get('/', listFinancePayments);
router.patch('/:paymentId/review', reviewFinancePayment);

export default router;
