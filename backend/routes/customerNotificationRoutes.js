import express from 'express';
import { listCustomerNotifications, markAllCustomerNotificationsRead, markCustomerNotificationRead } from '../controllers/customerNotificationController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('Customer'));
router.get('/', listCustomerNotifications);
router.patch('/read-all', markAllCustomerNotificationsRead);
router.patch('/:notificationId/read', markCustomerNotificationRead);

export default router;
