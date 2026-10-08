import express from 'express';
import { listCustomerRepairTracking } from '../controllers/customerRepairTrackingController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('Customer'));
router.get('/', listCustomerRepairTracking);

export default router;
