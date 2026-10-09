// Wire HTTP paths to controller actions. Middleware order determines which session and role checks run before each handler.
import express from 'express';
import {
  createCustomerVehicle,
  deleteCustomerVehicle,
  getCustomerVehicle,
  getCustomerVehicleProfile,
  listCustomerVehicles,
  updateCustomerVehicle,
} from '../controllers/customerVehicleController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('Customer'));
router.get('/', listCustomerVehicles);
router.post('/', createCustomerVehicle);
router.get('/:vehicleId/profile', getCustomerVehicleProfile);
router.get('/:vehicleId', getCustomerVehicle);
router.patch('/:vehicleId', updateCustomerVehicle);
router.delete('/:vehicleId', deleteCustomerVehicle);

export default router;
