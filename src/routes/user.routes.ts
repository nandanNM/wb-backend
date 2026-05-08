/**
 * @openapi
 * /users/me:
 *   get:
 *     summary: Get the authenticated user's full profile
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Full profile including XP, coins, streak, rank, and enrolled subjects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/UserProfile' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /users/me/stats:
 *   get:
 *     summary: Get XP, coins, streak, rank, and achievement count
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Aggregated stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalXp:          { type: integer }
 *                     weeklyXp:         { type: integer }
 *                     piCoins:          { type: integer }
 *                     currentStreak:    { type: integer }
 *                     longestStreak:    { type: integer }
 *                     globalRank:       { type: integer, nullable: true }
 *                     achievementCount: { type: integer }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /users/me/preferences:
 *   patch:
 *     summary: Update notification and display preferences
 *     tags: [Users]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               language:                    { type: string, enum: [en, bn] }
 *               notificationsEnabled:        { type: boolean }
 *               emailNotificationsEnabled:   { type: boolean }
 *               theme:                       { type: string, enum: [light, dark, system] }
 *     responses:
 *       200:
 *         description: Preferences updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: object }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /users/me/subjects:
 *   patch:
 *     summary: Update enrolled subjects
 *     tags: [Users]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subjectIds]
 *             properties:
 *               subjectIds:
 *                 type: array
 *                 items: { type: integer }
 *     responses:
 *       200:
 *         description: Enrollments updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: object }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /users/me/class:
 *   patch:
 *     summary: Set the student's class and exam board
 *     tags: [Users]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [classId]
 *             properties:
 *               classId:   { type: integer }
 *               examBoard: { type: string, enum: [wbbse, wbchse, cbse, icse, others] }
 *     responses:
 *       200:
 *         description: Class updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: object }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /users/me/avatar:
 *   post:
 *     summary: Upload a profile avatar (placeholder — returns mock URL)
 *     tags: [Users]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Avatar URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     avatarUrl: { type: string }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */

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
