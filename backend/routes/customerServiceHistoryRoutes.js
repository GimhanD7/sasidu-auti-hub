import express from 'express';
import { listCustomerServiceHistory } from '../controllers/customerServiceHistoryController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('Customer'));
router.get('/', listCustomerServiceHistory);

export default router;
