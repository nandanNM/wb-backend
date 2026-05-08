import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../lib/validate';
import { AppError } from '../../middleware/errorHandler';
import type { AuthRequest } from '../../middleware/requireAuth';
import {
  createTest,
  getTestById,
  listTests,
  updateTest,
  deleteTest,
  addQuestionsToTest,
  removeQuestionFromTest,
  reorderTestQuestions,
  getTestAttempts,
  getTestStats,
} from '../../services/test.service';
import { logger } from '../../utils/logger';

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const createTestSchema = z
  .object({
    title: z.string().min(1).max(200),
    titleBn: z.string().max(200).optional().nullable(),
    type: z.enum(['chapter_test', 'subject_test']),
    subjectId: z.number().int().positive().optional().nullable(),
    chapterId: z.number().int().positive().optional().nullable(),
    durationMinutes: z.number().int().positive().max(300).default(30),
    passingScore: z.number().int().nonnegative().optional().nullable(),
    isActive: z.boolean().default(true),
    questionIds: z.array(z.number().int().positive()).optional(),
  })
  .refine(
    (d) => d.type !== 'chapter_test' || d.chapterId != null,
    { message: 'chapterId is required for chapter_test', path: ['chapterId'] },
  )
  .refine(
    (d) => d.type !== 'subject_test' || d.subjectId != null,
    { message: 'subjectId is required for subject_test', path: ['subjectId'] },
  );

const updateTestSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    titleBn: z.string().max(200).optional().nullable(),
    type: z.enum(['chapter_test', 'subject_test']).optional(),
    subjectId: z.number().int().positive().optional().nullable(),
    chapterId: z.number().int().positive().optional().nullable(),
    durationMinutes: z.number().int().positive().max(300).optional(),
    passingScore: z.number().int().nonnegative().optional().nullable(),
    isActive: z.boolean().optional(),
  });

const listTestsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(['chapter_test', 'subject_test']).optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  chapterId: z.coerce.number().int().positive().optional(),
  isActive: z.string().transform((v) => v === 'true' ? true : v === 'false' ? false : undefined).optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(['createdAt', 'totalPoints', 'durationMinutes']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const addQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        questionId: z.number().int().positive(),
        order: z.number().int().positive(),
      }),
    )
    .min(1, 'At least one question is required'),
});

const reorderSchema = z.object({
  orders: z
    .array(
      z.object({
        questionId: z.number().int().positive(),
        order: z.number().int().positive(),
      }),
    )
    .min(1),
});

const listAttemptsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['in_progress', 'completed', 'abandoned']).optional(),
});

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/admin/tests:
 *   get:
 *     summary: List tests with pagination and filters
 *     tags: [Admin - Tests]
 */
export async function listTestsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = validate(listTestsSchema, req.query);
    const result = await listTests({
      ...query,
      isActive: query.isActive as boolean | undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * @openapi
 * /api/v1/admin/tests:
 *   post:
 *     summary: Create a new test (optionally with initial question IDs)
 *     tags: [Admin - Tests]
 */
export async function createTestHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = validate(createTestSchema, req.body);
    const test = await createTest(body);
    logger.info('Admin created test', { testId: test.id, adminId: (req as AuthRequest).userId });
    res.status(201).json({ data: test });
  } catch (err) {
    next(err);
  }
}

/**
 * @openapi
 * /api/v1/admin/tests/{id}:
 *   get:
 *     summary: Get full test detail with all questions (admin view — includes isCorrect)
 *     tags: [Admin - Tests]
 */
export async function getTestHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new AppError(400, 'Invalid test ID');

    const test = await getTestById(id);
    res.json({ data: test });
  } catch (err) {
    next(err);
  }
}

/**
 * @openapi
 * /api/v1/admin/tests/{id}:
 *   put:
 *     summary: Update test metadata (partial)
 *     tags: [Admin - Tests]
 */
export async function updateTestHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new AppError(400, 'Invalid test ID');

    const body = validate(updateTestSchema, req.body);
    const test = await updateTest(id, body);
    logger.info('Admin updated test', { testId: id, adminId: (req as AuthRequest).userId });
    res.json({ data: test });
  } catch (err) {
    next(err);
  }
}

/**
 * @openapi
 * /api/v1/admin/tests/{id}:
 *   delete:
 *     summary: Soft-delete test (sets isActive=false)
 *     tags: [Admin - Tests]
 */
export async function deleteTestHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new AppError(400, 'Invalid test ID');

    await deleteTest(id);
    logger.info('Admin deleted test', { testId: id, adminId: (req as AuthRequest).userId });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * @openapi
 * /api/v1/admin/tests/{id}/questions:
 *   post:
 *     summary: Add questions to a test (skips duplicates)
 *     tags: [Admin - Tests]
 */
export async function addQuestionsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new AppError(400, 'Invalid test ID');

    const body = validate(addQuestionsSchema, req.body);
    await addQuestionsToTest(id, body);
    res.json({ message: `${body.questions.length} question(s) added to test` });
  } catch (err) {
    next(err);
  }
}

/**
 * @openapi
 * /api/v1/admin/tests/{id}/questions/{questionId}:
 *   delete:
 *     summary: Remove a question from a test (totalPoints recalculated)
 *     tags: [Admin - Tests]
 */
export async function removeQuestionHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = parseInt(String(req.params.id), 10);
    const questionId = parseInt(String(req.params.questionId), 10);
    if (isNaN(testId) || isNaN(questionId)) throw new AppError(400, 'Invalid ID');

    await removeQuestionFromTest(testId, questionId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * @openapi
 * /api/v1/admin/tests/{id}/questions/reorder:
 *   patch:
 *     summary: Reorder questions within a test
 *     tags: [Admin - Tests]
 */
export async function reorderQuestionsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new AppError(400, 'Invalid test ID');

    const body = validate(reorderSchema, req.body);
    await reorderTestQuestions(id, body);
    res.json({ message: 'Questions reordered' });
  } catch (err) {
    next(err);
  }
}

/**
 * @openapi
 * /api/v1/admin/tests/{id}/attempts:
 *   get:
 *     summary: List student attempts for a test with student info
 *     tags: [Admin - Tests]
 */
export async function listAttemptsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new AppError(400, 'Invalid test ID');

    const query = validate(listAttemptsSchema, req.query);
    const result = await getTestAttempts(id, query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * @openapi
 * /api/v1/admin/tests/{id}/stats:
 *   get:
 *     summary: Aggregate statistics for a test (completion rate, avg score, pass rate)
 *     tags: [Admin - Tests]
 */
export async function testStatsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new AppError(400, 'Invalid test ID');

    const stats = await getTestStats(id);
    res.json({ data: stats });
  } catch (err) {
    next(err);
  }
}
