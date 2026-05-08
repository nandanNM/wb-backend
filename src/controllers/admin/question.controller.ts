import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../lib/validate';
import { AppError } from '../../middleware/errorHandler';
import type { AuthRequest } from '../../middleware/requireAuth';
import {
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getQuestionById,
  listQuestions,
} from '../../services/question.service';
import { bulkImportFromCSV } from '../../services/csv.service';
import { logger } from '../../utils/logger';

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const optionSchema = z.object({
  optionKey: z.enum(['A', 'B', 'C', 'D']),
  textEn: z.string().min(1, 'Option text is required'),
  textBn: z.string().optional().nullable(),
  isCorrect: z.boolean(),
  imageUrl: z.string().optional().nullable(),
  order: z.number().int().min(1).max(4),
});

const translationSchema = z.object({
  language: z.enum(['en', 'bn']),
  text: z.string().min(1, 'Translation text is required'),
  explanation: z.string().optional().nullable(),
});

const createQuestionSchema = z
  .object({
    chapterId: z.number().int().positive('chapterId must be a positive integer'),
    difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
    points: z.number().int().positive().max(1000).default(10),
    status: z.enum(['draft', 'published', 'archived']).default('draft'),
    category: z.string().max(100).optional().nullable(),
    tags: z.array(z.string().max(50)).max(20).default([]),
    imageUrl: z.string().optional().nullable(),
    translations: z
      .array(translationSchema)
      .min(1, 'At least one translation is required'),
    options: z.array(optionSchema).length(4, 'Exactly 4 options are required'),
  })
  .refine((d) => d.translations.some((t) => t.language === 'en'), {
    message: 'English translation is required',
    path: ['translations'],
  })
  .refine((d) => d.options.filter((o) => o.isCorrect).length === 1, {
    message: 'Exactly one option must be marked as correct',
    path: ['options'],
  });

const updateQuestionSchema = z
  .object({
    chapterId: z.number().int().positive().optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    points: z.number().int().positive().max(1000).optional(),
    status: z.enum(['draft', 'published', 'archived']).optional(),
    category: z.string().max(100).optional().nullable(),
    tags: z.array(z.string().max(50)).max(20).optional(),
    imageUrl: z.string().optional().nullable(),
    translations: z.array(translationSchema).min(1).optional(),
    options: z.array(optionSchema).length(4).optional(),
  })
  .refine(
    (d) => !d.translations || d.translations.some((t) => t.language === 'en'),
    { message: 'English translation is required when updating translations', path: ['translations'] },
  )
  .refine(
    (d) => !d.options || d.options.filter((o) => o.isCorrect).length === 1,
    { message: 'Exactly one option must be marked as correct', path: ['options'] },
  );

const listQuestionsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  chapterId: z.coerce.number().int().positive().optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  category: z.string().optional(),
  search: z.string().max(200).optional(),
  tags: z.string().optional(), // comma-separated, e.g. "algebra,geometry"
  sortBy: z.enum(['createdAt', 'points']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * @openapi
 * /admin/questions:
 *   post:
 *     summary: Create a single question
 *     tags: [Admin - Questions]
 *     security: [{ bearerAuth: [] }]
 */
export async function createQuestionHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = validate(createQuestionSchema, req.body);
    const question = await createQuestion(body);
    logger.info('Admin created question', { questionId: question.id, adminId: (req as AuthRequest).userId });
    res.status(201).json({ data: question });
  } catch (err) {
    next(err);
  }
}

/**
 * @openapi
 * /admin/questions/{id}:
 *   get:
 *     summary: Get full question details (includes options with isCorrect)
 *     tags: [Admin - Questions]
 *     security: [{ bearerAuth: [] }]
 */
export async function getQuestionHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new AppError(400, 'Invalid question ID');

    const question = await getQuestionById(id);
    res.json({ data: question });
  } catch (err) {
    next(err);
  }
}

/**
 * @openapi
 * /admin/questions:
 *   get:
 *     summary: List questions with pagination, filters, and search
 *     tags: [Admin - Questions]
 *     security: [{ bearerAuth: [] }]
 */
export async function listQuestionsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = validate(listQuestionsSchema, req.query);

    const tags = query.tags
      ? query.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : undefined;

    const result = await listQuestions({ ...query, tags });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * @openapi
 * /admin/questions/{id}:
 *   put:
 *     summary: Update a question (partial update — only send fields you want to change)
 *     tags: [Admin - Questions]
 *     security: [{ bearerAuth: [] }]
 */
export async function updateQuestionHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new AppError(400, 'Invalid question ID');

    const body = validate(updateQuestionSchema, req.body);
    const question = await updateQuestion(id, body);
    logger.info('Admin updated question', { questionId: id, adminId: (req as AuthRequest).userId });
    res.json({ data: question });
  } catch (err) {
    next(err);
  }
}

/**
 * @openapi
 * /admin/questions/{id}:
 *   delete:
 *     summary: Soft-delete a question (sets isActive=false, status=archived)
 *     tags: [Admin - Questions]
 *     security: [{ bearerAuth: [] }]
 */
export async function deleteQuestionHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new AppError(400, 'Invalid question ID');

    await deleteQuestion(id);
    logger.info('Admin deleted question', { questionId: id, adminId: (req as AuthRequest).userId });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * @openapi
 * /admin/questions/bulk-upload:
 *   post:
 *     summary: Bulk import questions from a CSV file
 *     tags: [Admin - Questions]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *
 * CSV columns (order matters):
 *   chapterId, questionEn, questionBn, explanationEn, explanationBn,
 *   difficulty, points, status, category, tags,
 *   optionAEn, optionABn, optionBEn, optionBBn, optionCEn, optionCBn, optionDEn, optionDBn,
 *   correctOption
 */
export async function bulkUploadCSVHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) throw new AppError(400, 'CSV file is required (field name: "file")');

    const result = await bulkImportFromCSV(req.file.buffer);

    logger.info('Admin bulk CSV import', {
      adminId: (req as AuthRequest).userId,
      total: result.total,
      inserted: result.inserted,
      errors: result.errors.length,
    });

    res.status(200).json({
      message: `Import complete. ${result.inserted} inserted, ${result.errors.length} failed.`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}
