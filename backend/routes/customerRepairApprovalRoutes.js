import express from 'express';
import { decideCustomerRepairApproval, listCustomerRepairApprovals } from '../controllers/customerRepairApprovalController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('Customer'));
router.get('/', listCustomerRepairApprovals);
router.patch('/:jobId/repairs/:repairId/decision', decideCustomerRepairApproval);

export default router;
