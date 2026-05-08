/**
 * @openapi
 * /referrals/my-code:
 *   get:
 *     summary: Get the authenticated user's referral code and stats
 *     tags: [Referrals]
 *     responses:
 *       200:
 *         description: Referral code with total/completed count and Pi Coins earned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/ReferralCodeInfo' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /referrals/history:
 *   get:
 *     summary: List all referrals made by the authenticated user
 *     tags: [Referrals]
 *     responses:
 *       200:
 *         description: Referral history with referred user details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:             { type: integer }
 *                       referredUserId: { type: string }
 *                       referredName:   { type: string }
 *                       piCoinsEarned:  { type: integer }
 *                       status:         { type: string, enum: [pending, completed] }
 *                       createdAt:      { type: string, format: date-time }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /referrals/apply:
 *   post:
 *     summary: Apply a referral code (one-time per user, awards 100 Pi Coins to referrer)
 *     tags: [Referrals]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, example: WB-AB12CD }
 *     responses:
 *       200:
 *         description: Referral applied successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     message: { type: string }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import * as referral from '../controllers/referral.controller';

const router: Router = Router();

router.use(requireAuth);

router.get('/my-code', referral.getMyReferralCode);
router.get('/history', referral.getReferralHistory);
router.post('/apply', referral.applyReferralCode);

export default router;
