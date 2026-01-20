import { Router } from 'express';
import { requireAuth } from '../utils/auth';
import { addTransaction, getUser, login } from '../controllers/dbController';

const router = Router();

router.post('/auth/login', login);
router.get('/users/:email', requireAuth, getUser);
router.post('/users/:email/transaction', requireAuth, addTransaction);

export default router;
