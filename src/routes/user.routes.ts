import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import * as user from '../controllers/user.controller';

const router: Router = Router();

router.use(requireAuth);

router.get('/me', user.getMyProfile);
router.get('/me/stats', user.getMyStats);
router.patch('/me/preferences', user.updatePreferences);
router.patch('/me/subjects', user.updateSubjects);
router.patch('/me/class', user.updateClass);
router.post('/me/avatar', user.uploadAvatar);

export default router;
