/**
 * @openapi
 * tags:
 *   - name: Admin - Tests
 *     description: Admin-only test management endpoints
 */

import { Router } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin';
import {
  listTestsHandler,
  createTestHandler,
  getTestHandler,
  updateTestHandler,
  deleteTestHandler,
  addQuestionsHandler,
  removeQuestionHandler,
  reorderQuestionsHandler,
  listAttemptsHandler,
  testStatsHandler,
} from '../../controllers/admin/test.controller';

const adminTestRouter: Router = Router();

adminTestRouter.use(requireAdmin);

// ── Test CRUD ─────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/admin/tests:
 *   get:
 *     summary: List tests
 *     tags: [Admin - Tests]
 *     parameters:
 *       - { in: query, name: page,            schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit,           schema: { type: integer, default: 20, maximum: 100 } }
 *       - { in: query, name: type,            schema: { type: string, enum: [chapter_test, subject_test] } }
 *       - { in: query, name: subjectId,       schema: { type: integer } }
 *       - { in: query, name: chapterId,       schema: { type: integer } }
 *       - { in: query, name: isActive,        schema: { type: boolean } }
 *       - { in: query, name: search,          schema: { type: string } }
 *       - { in: query, name: sortBy,          schema: { type: string, enum: [createdAt, totalPoints, durationMinutes] } }
 *       - { in: query, name: sortOrder,       schema: { type: string, enum: [asc, desc] } }
 */
adminTestRouter.get('/', listTestsHandler);

/**
 * @openapi
 * /api/v1/admin/tests:
 *   post:
 *     summary: Create a test
 *     tags: [Admin - Tests]
 */
adminTestRouter.post('/', createTestHandler);

// ── Fixed sub-paths before /:id to avoid route shadowing ─────────────────────

/**
 * @openapi
 * /api/v1/admin/tests/{id}/questions/reorder:
 *   patch:
 *     summary: Reorder questions in a test
 *     tags: [Admin - Tests]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 */
adminTestRouter.patch('/:id/questions/reorder', reorderQuestionsHandler);

/**
 * @openapi
 * /api/v1/admin/tests/{id}/questions:
 *   post:
 *     summary: Add questions to a test
 *     tags: [Admin - Tests]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 */
adminTestRouter.post('/:id/questions', addQuestionsHandler);

/**
 * @openapi
 * /api/v1/admin/tests/{id}/questions/{questionId}:
 *   delete:
 *     summary: Remove a question from a test
 *     tags: [Admin - Tests]
 *     parameters:
 *       - { in: path, name: id,         required: true, schema: { type: integer } }
 *       - { in: path, name: questionId, required: true, schema: { type: integer } }
 */
adminTestRouter.delete('/:id/questions/:questionId', removeQuestionHandler);

/**
 * @openapi
 * /api/v1/admin/tests/{id}/attempts:
 *   get:
 *     summary: List student attempts for a test
 *     tags: [Admin - Tests]
 *     parameters:
 *       - { in: path,  name: id,     required: true, schema: { type: integer } }
 *       - { in: query, name: page,   schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit,  schema: { type: integer, default: 20 } }
 *       - { in: query, name: status, schema: { type: string, enum: [in_progress, completed, abandoned] } }
 */
adminTestRouter.get('/:id/attempts', listAttemptsHandler);

/**
 * @openapi
 * /api/v1/admin/tests/{id}/stats:
 *   get:
 *     summary: Aggregate statistics for a test
 *     tags: [Admin - Tests]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 */
adminTestRouter.get('/:id/stats', testStatsHandler);

// ── Test detail / update / delete ─────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/admin/tests/{id}:
 *   get:
 *     summary: Get test detail with all questions (isCorrect visible)
 *     tags: [Admin - Tests]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 */
adminTestRouter.get('/:id', getTestHandler);

/**
 * @openapi
 * /api/v1/admin/tests/{id}:
 *   put:
 *     summary: Update test metadata (partial)
 *     tags: [Admin - Tests]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 */
adminTestRouter.put('/:id', updateTestHandler);

/**
 * @openapi
 * /api/v1/admin/tests/{id}:
 *   delete:
 *     summary: Soft-delete a test
 *     tags: [Admin - Tests]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 */
adminTestRouter.delete('/:id', deleteTestHandler);

export default adminTestRouter;
