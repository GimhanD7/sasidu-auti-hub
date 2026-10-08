import express from 'express';
import { registerUser, loginUser, adminLoginUser, logoutUser, getCurrentUser, forgotPassword, resetPassword } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { authRateLimit } from '../middleware/authRateLimit.js';
import { getCustomerDashboard } from '../controllers/customerDashboardController.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.post('/register', authRateLimit(20), registerUser);
router.post('/login', authRateLimit(30), loginUser);
router.post('/admin/login', authRateLimit(30), adminLoginUser);
router.get('/me', requireAuth, getCurrentUser);
router.get('/customer-dashboard', requireAuth, requireRole('Customer'), getCustomerDashboard);
router.post('/logout', logoutUser);
router.post('/forgot-password', authRateLimit(5), forgotPassword);
router.post('/reset-password', authRateLimit(10), resetPassword);

export default router;
