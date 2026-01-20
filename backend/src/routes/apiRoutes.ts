import { Router } from 'express';
import { requireAuth } from '../utils/auth';
import { getConfig, getPackages, generate, streamUpdate } from '../controllers/aiController';

const router = Router();

router.get('/config', getConfig);
router.get('/packages', getPackages);
router.post('/generate', requireAuth, generate);
router.post('/stream-update', requireAuth, streamUpdate);

export default router;
