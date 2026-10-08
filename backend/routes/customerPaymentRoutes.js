import express from 'express';
import { getCustomerPaymentOptions, submitCustomerPayment } from '../controllers/customerPaymentController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('Customer'));
router.get('/', getCustomerPaymentOptions);
router.post('/', submitCustomerPayment);

export default router;
