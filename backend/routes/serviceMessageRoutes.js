import express from 'express';
import { listMessageThreads, listServiceMessages, markServiceMessagesRead, sendServiceMessage } from '../controllers/serviceMessageController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);
router.get('/threads', listMessageThreads);
router.get('/:jobId/messages', listServiceMessages);
router.post('/:jobId/messages', sendServiceMessage);
router.patch('/:jobId/read', markServiceMessagesRead);

export default router;
