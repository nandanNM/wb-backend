import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../lib/validate';
import { AppError } from '../../middleware/errorHandler';
import type { AuthRequest } from '../../middleware/requireAuth';
import { uploadFile } from '../../lib/upload';
import {
  createNote,
  getNoteById,
  listNotes,
  updateNote,
  setNotePublished,
  deleteNote,
} from '../../services/note.service';
import { logger } from '../../utils/logger';

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const createNoteSchema = z.object({
  title: z.string().min(1).max(300),
  titleBn: z.string().max(300).optional().nullable(),
  subjectId: z.number().int().positive().optional().nullable(),
  chapterId: z.number().int().positive().optional().nullable(),
  pdfUrl: z.string().min(1, 'pdfUrl is required'),
  fileSizeBytes: z.number().int().positive().optional().nullable(),
  pageCount: z.number().int().positive().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  isPublished: z.boolean().default(false),
});

const updateNoteSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  titleBn: z.string().max(300).optional().nullable(),
  subjectId: z.number().int().positive().optional().nullable(),
  chapterId: z.number().int().positive().optional().nullable(),
  pdfUrl: z.string().min(1).optional(),
  fileSizeBytes: z.number().int().positive().optional().nullable(),
  pageCount: z.number().int().positive().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  isPublished: z.boolean().optional(),
});

const listNotesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  subjectId: z.coerce.number().int().positive().optional(),
  chapterId: z.coerce.number().int().positive().optional(),
  isPublished: z
    .string()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined))
    .optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(['createdAt', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/admin/notes:
 *   get:
 *     summary: List all notes with pagination and filters (admin — sees unpublished too)
 *     tags: [Admin - Notes]
 */
export async function listNotesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = validate(listNotesSchema, req.query);
    const result = await listNotes({ ...query, isPublished: query.isPublished as boolean | undefined });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * @openapi
 * /api/v1/admin/notes:
 *   post:
 *     summary: Create a note (provide pdfUrl from a prior upload)
 *     tags: [Admin - Notes]
 */
export async function createNoteHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = (req as AuthRequest).userId;
    const body = validate(createNoteSchema, req.body);
    const note = await createNote({ ...body, uploadedBy: adminId });
    logger.info('Admin created note', { noteId: note.id, adminId });
    res.status(201).json({ data: note });
  } catch (err) {
    next(err);
  }
}

/**
 * @openapi
 * /api/v1/admin/notes/{id}:
 *   get:
 *     summary: Get note detail (admin — no isPublished filter, includes readerCount)
 *     tags: [Admin - Notes]
 */
export async function getNoteHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new AppError(400, 'Invalid note ID');
    res.json({ data: await getNoteById(id) });
  } catch (err) {
    next(err);
  }
}

/**
 * @openapi
 * /api/v1/admin/notes/{id}:
 *   put:
 *     summary: Update note metadata (partial)
 *     tags: [Admin - Notes]
 */
export async function updateNoteHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new AppError(400, 'Invalid note ID');
    const body = validate(updateNoteSchema, req.body);
    const note = await updateNote(id, body);
    logger.info('Admin updated note', { noteId: id, adminId: (req as AuthRequest).userId });
    res.json({ data: note });
  } catch (err) {
    next(err);
  }
}

/**
 * @openapi
 * /api/v1/admin/notes/{id}/publish:
 *   patch:
 *     summary: Publish a note (make it visible to students)
 *     tags: [Admin - Notes]
 */
export async function publishNoteHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new AppError(400, 'Invalid note ID');
    const note = await setNotePublished(id, true);
    logger.info('Admin published note', { noteId: id, adminId: (req as AuthRequest).userId });
    res.json({ data: note });
  } catch (err) {
    next(err);
  }
}

/**
 * @openapi
 * /api/v1/admin/notes/{id}/unpublish:
 *   patch:
 *     summary: Unpublish a note (hide from students)
 *     tags: [Admin - Notes]
 */
export async function unpublishNoteHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new AppError(400, 'Invalid note ID');
    const note = await setNotePublished(id, false);
    logger.info('Admin unpublished note', { noteId: id, adminId: (req as AuthRequest).userId });
    res.json({ data: note });
  } catch (err) {
    next(err);
  }
}

/**
 * @openapi
 * /api/v1/admin/notes/{id}:
 *   delete:
 *     summary: Permanently delete a note
 *     tags: [Admin - Notes]
 */
export async function deleteNoteHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) throw new AppError(400, 'Invalid note ID');
    await deleteNote(id);
    logger.info('Admin deleted note', { noteId: id, adminId: (req as AuthRequest).userId });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * @openapi
 * /api/v1/admin/notes/upload-pdf:
 *   post:
 *     summary: Upload a PDF and get back a URL to use in create/update
 *     tags: [Admin - Notes]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 */
export async function uploadPdfHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) throw new AppError(400, 'PDF file is required (field name: "file")');

    const result = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    logger.info('Admin uploaded PDF', { key: result.key, adminId: (req as AuthRequest).userId });
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}
