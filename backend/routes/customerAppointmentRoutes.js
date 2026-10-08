import express from 'express';
import {
  createCustomerAppointment,
  cancelCustomerAppointment,
  getAppointmentAvailability,
  getAppointmentOptions,
  listCustomerAppointments,
  requestCustomerAppointmentReschedule,
} from '../controllers/customerAppointmentController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('Customer'));
router.get('/options', getAppointmentOptions);
router.get('/availability', getAppointmentAvailability);
router.get('/', listCustomerAppointments);
router.post('/', createCustomerAppointment);
router.patch('/:appointmentId/cancel', cancelCustomerAppointment);
router.post('/:appointmentId/reschedule-request', requestCustomerAppointmentReschedule);

export default router;
