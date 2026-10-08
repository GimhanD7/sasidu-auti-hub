import express from 'express';
import { registerUser, loginUser, adminLoginUser, technicianLoginUser, changeTechnicianPassword, logoutUser, getCurrentUser, updateCurrentUser, forgotPassword, resetPassword } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { authRateLimit } from '../middleware/authRateLimit.js';
import { getCustomerDashboard } from '../controllers/customerDashboardController.js';
import { requireRole } from '../middleware/auth.js';
import { getTechnicianDashboard } from '../controllers/technicianDashboardController.js';
import { listTechnicianJobs, listTechnicianJobHistory, getTechnicianJob, searchTechnicianParts } from '../controllers/technicianJobController.js';
import { updateTechnicianJobCard, uploadTechnicianJobPhoto, getTechnicianJobPhoto } from '../controllers/technicianJobCardController.js';

const router = express.Router();

router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.post('/register', authRateLimit(20), registerUser);
router.post('/login', authRateLimit(30), loginUser);
router.post('/admin/login', authRateLimit(30), adminLoginUser);
router.post('/technician/login', authRateLimit(30), technicianLoginUser);
router.get('/me', requireAuth, getCurrentUser);
router.patch('/me', requireAuth, updateCurrentUser);
router.get('/customer-dashboard', requireAuth, requireRole('Customer'), getCustomerDashboard);
router.get('/technician-dashboard', requireAuth, requireRole('Technician'), getTechnicianDashboard);
router.get('/technician/jobs', requireAuth, requireRole('Technician'), listTechnicianJobs);
router.get('/technician/jobs/history', requireAuth, requireRole('Technician'), listTechnicianJobHistory);
router.get('/technician/parts', requireAuth, requireRole('Technician'), searchTechnicianParts);
router.patch('/technician/jobs/:jobId/card', requireAuth, requireRole('Technician'), updateTechnicianJobCard);
router.post('/technician/jobs/:jobId/photos', requireAuth, requireRole('Technician'), uploadTechnicianJobPhoto);
router.get('/technician/jobs/:jobId/photos/:photoId', requireAuth, requireRole('Technician'), getTechnicianJobPhoto);
router.get('/technician/jobs/:jobId', requireAuth, requireRole('Technician'), getTechnicianJob);
router.post('/logout', logoutUser);
router.post('/change-password', requireAuth, authRateLimit(10), changeTechnicianPassword);
router.post('/technician/change-password', requireAuth, requireRole('Technician'), authRateLimit(10), changeTechnicianPassword);
router.post('/forgot-password', authRateLimit(5), forgotPassword);
router.post('/reset-password', authRateLimit(10), resetPassword);

export default router;
