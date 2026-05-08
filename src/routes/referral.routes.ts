import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import * as referral from '../controllers/referral.controller';

const router: Router = Router();

router.use(requireAuth);

router.get('/my-code', referral.getMyReferralCode);
router.get('/history', referral.getReferralHistory);
router.post('/apply', referral.applyReferralCode);

export default router;
