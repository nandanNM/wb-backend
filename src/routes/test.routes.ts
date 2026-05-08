/**
 * @openapi
 * /tests/mixed:
 *   get:
 *     summary: List all active subject-type (mixed) tests
 *     tags: [Tests]
 *     responses:
 *       200:
 *         description: List of tests with completion status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Test'
 *                       - type: object
 *                         properties:
 *                           isLocked:    { type: boolean }
 *                           isCompleted: { type: boolean }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /tests/my-attempts:
 *   get:
 *     summary: List the current user's test attempts
 *     tags: [Tests]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *     responses:
 *       200:
 *         description: Paginated attempt history
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
 *                       attempt:   { $ref: '#/components/schemas/TestAttempt' }
 *                       testTitle: { type: string }
 *                       testType:  { type: string }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /tests/chapters/{chapterId}:
 *   get:
 *     summary: List tests in a chapter (with sequential lock status)
 *     tags: [Tests]
 *     parameters:
 *       - in: path
 *         name: chapterId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Chapter tests with lock/completion status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: array, items: { allOf: [{ $ref: '#/components/schemas/Test' }, { type: object, properties: { isLocked: { type: boolean }, isCompleted: { type: boolean } } }] } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /tests/subjects/{subjectId}:
 *   get:
 *     summary: List subject-level tests
 *     tags: [Tests]
 *     parameters:
 *       - in: path
 *         name: subjectId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Subject tests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: array, items: { $ref: '#/components/schemas/Test' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /tests/{testId}:
 *   get:
 *     summary: Get full test detail with questions (correct answers hidden)
 *     tags: [Tests]
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Test with questions and options (isCorrect omitted)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/TestWithQuestions' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *
 * /tests/{testId}/start:
 *   post:
 *     summary: Start or resume a test attempt
 *     tags: [Tests]
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Resumed existing in-progress attempt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:    { $ref: '#/components/schemas/TestAttempt' }
 *                 resumed: { type: boolean }
 *       201:
 *         description: New attempt created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:    { $ref: '#/components/schemas/TestAttempt' }
 *                 resumed: { type: boolean }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *
 * /tests/attempts/{attemptId}/answer:
 *   post:
 *     summary: Submit an answer for one question in an in-progress attempt
 *     tags: [Tests]
 *     parameters:
 *       - in: path
 *         name: attemptId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [questionId]
 *             properties:
 *               questionId:       { type: integer }
 *               selectedOptionId: { type: integer, nullable: true }
 *               timeTakenSeconds: { type: integer }
 *     responses:
 *       200:
 *         description: Answer recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     isCorrect: { type: boolean, nullable: true }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /tests/attempts/{attemptId}/complete:
 *   post:
 *     summary: Complete a test — calculates score and awards XP
 *     tags: [Tests]
 *     parameters:
 *       - in: path
 *         name: attemptId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Test completed with results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     attemptId:      { type: integer }
 *                     score:          { type: integer }
 *                     totalPoints:    { type: integer }
 *                     xpEarned:       { type: integer }
 *                     isPassed:       { type: boolean }
 *                     isPerfect:      { type: boolean }
 *                     correctAnswers: { type: integer }
 *                     totalAnswers:   { type: integer }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /tests/attempts/{attemptId}/result:
 *   get:
 *     summary: Get attempt results with explanations (after completion)
 *     tags: [Tests]
 *     parameters:
 *       - in: path
 *         name: attemptId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Attempt with per-question results and explanations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     attempt: { $ref: '#/components/schemas/TestAttempt' }
 *                     answers: { type: array, items: { type: object } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import * as test from '../controllers/test.controller';

const router: Router = Router();

router.use(requireAuth);

// Fixed-path routes must come before /:testId to avoid shadowing
router.get('/mixed', test.getMixedTests);
router.get('/my-attempts', test.getMyAttempts);
router.get('/chapters/:chapterId', test.getChapterTests);
router.get('/subjects/:subjectId', test.getSubjectTests);
router.get('/attempts/:attemptId/result', test.getAttemptResult);
router.get('/:testId', test.getTestDetail);

router.post('/:testId/start', test.startTest);
router.post('/attempts/:attemptId/answer', test.submitAnswer);
router.post('/attempts/:attemptId/complete', test.completeTest);

export default router;
