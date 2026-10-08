import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getFinanceDashboard } from '../controllers/financeDashboardController.js';

const router = express.Router();
router.use(requireAuth, requireRole('Finance', 'Admin'));
router.get('/', getFinanceDashboard);

export default router;
