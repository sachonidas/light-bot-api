import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getProfile, updateProfile } from '../controllers/user.controller';

const router = Router();

router.use(authMiddleware);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

export default router;
