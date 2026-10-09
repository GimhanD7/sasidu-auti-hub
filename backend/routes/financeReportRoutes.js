import express from 'express';
import { getFinancePartsReport, getFinanceRevenueByService, getFinanceRevenueReport, getFinanceTechnicianReport } from '../controllers/financeReportController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('Admin'));
router.get('/', getFinanceRevenueReport);
router.get('/by-service', getFinanceRevenueByService);
router.get('/parts', getFinancePartsReport);
router.get('/technicians', getFinanceTechnicianReport);

export default router;
