import express from 'express';
import {
  createCustomerAppointment,
  getAppointmentAvailability,
  getAppointmentOptions,
} from '../controllers/customerAppointmentController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('Customer'));
router.get('/options', getAppointmentOptions);
router.get('/availability', getAppointmentAvailability);
router.post('/', createCustomerAppointment);

export default router;
