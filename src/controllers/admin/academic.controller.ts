import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../lib/validate';
import { AppError } from '../../middleware/errorHandler';
import type { AuthRequest } from '../../middleware/requireAuth';

// Static reference data — sourced from DB enums; update if enums change
const EXAM_BOARDS = [
  { value: 'wbbse',  label: 'WBBSE',  description: 'West Bengal Board of Secondary Education (Class 9–10)' },
  { value: 'wbchse', label: 'WBCHSE', description: 'West Bengal Council of Higher Secondary Education (Class 11–12)' },
  { value: 'cbse',   label: 'CBSE',   description: 'Central Board of Secondary Education' },
  { value: 'icse',   label: 'ICSE',   description: 'Indian Certificate of Secondary Education' },
  { value: 'others', label: 'Others', description: 'Any other board' },
] as const;

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'bn', label: 'Bengali (বাংলা)' },
] as const;
import {
  listClasses, createClass, updateClass, deleteClass,
  listSubjects, createSubject, updateSubject, deleteSubject,
  listChapters, createChapter, updateChapter, deleteChapter,
} from '../../services/academic.service';
import { logger } from '../../utils/logger';

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const createClassSchema = z.object({
  name: z.string().min(1).max(100),
  order: z.number().int().nonnegative(),
});

const updateClassSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  order: z.number().int().nonnegative().optional(),
});

const createSubjectSchema = z.object({
  classId: z.number().int().positive(),
  name: z.string().min(1).max(200),
  nameBn: z.string().max(200).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  iconUrl: z.string().optional().nullable(),
});

const updateSubjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  nameBn: z.string().max(200).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  iconUrl: z.string().optional().nullable(),
});

const createChapterSchema = z.object({
  subjectId: z.number().int().positive(),
  name: z.string().min(1).max(200),
  nameBn: z.string().max(200).optional().nullable(),
  order: z.number().int().nonnegative().optional(),
});

const updateChapterSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  nameBn: z.string().max(200).optional().nullable(),
  order: z.number().int().nonnegative().optional(),
});

// ─── Reference data ───────────────────────────────────────────────────────────

/** @openapi
 * /api/v1/admin/academic/boards:
 *   get:
 *     summary: List all available exam boards (used for student onboarding dropdowns)
 *     tags: [Admin - Academic]
 */
export async function listBoardsHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ data: EXAM_BOARDS });
  } catch (err) { next(err); }
}

/** @openapi
 * /api/v1/admin/academic/languages:
 *   get:
 *     summary: List all supported content languages
 *     tags: [Admin - Academic]
 */
export async function listLanguagesHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ data: LANGUAGES });
  } catch (err) { next(err); }
}

// ─── Classes ──────────────────────────────────────────────────────────────────

/** @openapi
 * /api/v1/admin/academic/classes:
 *   get:
 *     summary: List all classes ordered by display order
 *     tags: [Admin - Academic]
 */
export async function listClassesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ data: await listClasses() });
  } catch (err) { next(err); }
}

/** @openapi
 * /api/v1/admin/academic/classes:
 *   post:
 *     summary: Create a class
 *     tags: [Admin - Academic]
 */
export async function createClassHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = validate(createClassSchema, req.body);
    const cls = await createClass(body);
    logger.info('Admin created class', { classId: cls.id, adminId: (req as AuthRequest).userId });
    res.status(201).json({ data: cls });
  } catch (err) { next(err); }
}

/** @openapi
 * /api/v1/admin/academic/classes/{id}:
 *   put:
 *     summary: Update a class
 *     tags: [Admin - Academic]
 */
export async function updateClassHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new AppError(400, 'Invalid class ID');
    const body = validate(updateClassSchema, req.body);
    res.json({ data: await updateClass(id, body) });
  } catch (err) { next(err); }
}

/** @openapi
 * /api/v1/admin/academic/classes/{id}:
 *   delete:
 *     summary: Delete a class — use ?force=true to cascade-delete subjects/chapters/questions
 *     tags: [Admin - Academic]
 */
export async function deleteClassHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new AppError(400, 'Invalid class ID');
    const force = req.query.force === 'true';
    await deleteClass(id, force);
    logger.info('Admin deleted class', { classId: id, adminId: (req as AuthRequest).userId });
    res.status(204).send();
  } catch (err) { next(err); }
}

// ─── Subjects ─────────────────────────────────────────────────────────────────

/** @openapi
 * /api/v1/admin/academic/subjects:
 *   get:
 *     summary: List subjects, optionally filtered by classId
 *     tags: [Admin - Academic]
 */
export async function listSubjectsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const classId = req.query.classId ? parseInt(String(req.query.classId), 10) : undefined;
    if (classId !== undefined && isNaN(classId)) throw new AppError(400, 'Invalid classId');
    res.json({ data: await listSubjects(classId) });
  } catch (err) { next(err); }
}

/** @openapi
 * /api/v1/admin/academic/subjects:
 *   post:
 *     summary: Create a subject under a class
 *     tags: [Admin - Academic]
 */
export async function createSubjectHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = validate(createSubjectSchema, req.body);
    const subject = await createSubject(body);
    logger.info('Admin created subject', { subjectId: subject.id, adminId: (req as AuthRequest).userId });
    res.status(201).json({ data: subject });
  } catch (err) { next(err); }
}

/** @openapi
 * /api/v1/admin/academic/subjects/{id}:
 *   put:
 *     summary: Update a subject
 *     tags: [Admin - Academic]
 */
export async function updateSubjectHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new AppError(400, 'Invalid subject ID');
    const body = validate(updateSubjectSchema, req.body);
    res.json({ data: await updateSubject(id, body) });
  } catch (err) { next(err); }
}

/** @openapi
 * /api/v1/admin/academic/subjects/{id}:
 *   delete:
 *     summary: Delete a subject — use ?force=true to cascade-delete chapters/questions
 *     tags: [Admin - Academic]
 */
export async function deleteSubjectHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new AppError(400, 'Invalid subject ID');
    const force = req.query.force === 'true';
    await deleteSubject(id, force);
    logger.info('Admin deleted subject', { subjectId: id, adminId: (req as AuthRequest).userId });
    res.status(204).send();
  } catch (err) { next(err); }
}

// ─── Chapters ─────────────────────────────────────────────────────────────────

/** @openapi
 * /api/v1/admin/academic/chapters:
 *   get:
 *     summary: List chapters, optionally filtered by subjectId
 *     tags: [Admin - Academic]
 */
export async function listChaptersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const subjectId = req.query.subjectId ? parseInt(String(req.query.subjectId), 10) : undefined;
    if (subjectId !== undefined && isNaN(subjectId)) throw new AppError(400, 'Invalid subjectId');
    res.json({ data: await listChapters(subjectId) });
  } catch (err) { next(err); }
}

/** @openapi
 * /api/v1/admin/academic/chapters:
 *   post:
 *     summary: Create a chapter under a subject
 *     tags: [Admin - Academic]
 */
export async function createChapterHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = validate(createChapterSchema, req.body);
    const chapter = await createChapter(body);
    logger.info('Admin created chapter', { chapterId: chapter.id, adminId: (req as AuthRequest).userId });
    res.status(201).json({ data: chapter });
  } catch (err) { next(err); }
}

/** @openapi
 * /api/v1/admin/academic/chapters/{id}:
 *   put:
 *     summary: Update a chapter
 *     tags: [Admin - Academic]
 */
export async function updateChapterHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new AppError(400, 'Invalid chapter ID');
    const body = validate(updateChapterSchema, req.body);
    res.json({ data: await updateChapter(id, body) });
  } catch (err) { next(err); }
}

/** @openapi
 * /api/v1/admin/academic/chapters/{id}:
 *   delete:
 *     summary: Delete a chapter — use ?force=true to cascade-delete questions
 *     tags: [Admin - Academic]
 */
export async function deleteChapterHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new AppError(400, 'Invalid chapter ID');
    const force = req.query.force === 'true';
    await deleteChapter(id, force);
    logger.info('Admin deleted chapter', { chapterId: id, adminId: (req as AuthRequest).userId });
    res.status(204).send();
  } catch (err) { next(err); }
}
