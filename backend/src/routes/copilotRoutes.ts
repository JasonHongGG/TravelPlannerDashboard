import { Router } from 'express';
import { processCopilot } from '../controllers/copilotController';

const router = Router();

router.post('/process', processCopilot);

export default router;
