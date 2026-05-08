import { Request, Response, NextFunction } from 'express';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { notes, userNoteProgress } from '../db/schema';
import { AppError } from '../middleware/errorHandler';
import { validate } from '../lib/validate';
import type { AuthRequest } from '../middleware/requireAuth';

const listNotesQuerySchema = z.object({
  subjectId: z.coerce.number().int().positive().optional(),
  chapterId: z.coerce.number().int().positive().optional(),
});

export async function listNotes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as AuthRequest).userId;
    const query = validate(listNotesQuerySchema, req.query);

    const conditions = [eq(notes.isPublished, true)];
    if (query.subjectId) conditions.push(eq(notes.subjectId, query.subjectId));
    if (query.chapterId) conditions.push(eq(notes.chapterId, query.chapterId));

    const noteList = await db
      .select({
        id: notes.id,
        title: notes.title,
        titleBn: notes.titleBn,
        subjectId: notes.subjectId,
        chapterId: notes.chapterId,
        description: notes.description,
        fileSizeBytes: notes.fileSizeBytes,
        pageCount: notes.pageCount,
        createdAt: notes.createdAt,
      })
      .from(notes)
      .where(and(...conditions));

    const progressRows = noteList.length
      ? await db
          .select({ noteId: userNoteProgress.noteId, isRead: userNoteProgress.isRead, lastViewedAt: userNoteProgress.lastViewedAt })
          .from(userNoteProgress)
          .where(
            and(
              eq(userNoteProgress.userId, userId),
              inArray(userNoteProgress.noteId, noteList.map((n) => n.id)),
            ),
          )
      : [];

    const progressMap = new Map(progressRows.map((p) => [p.noteId, p]));

    res.json({
      data: noteList.map((note) => ({
        ...note,
        isRead: progressMap.get(note.id)?.isRead ?? false,
        lastViewedAt: progressMap.get(note.id)?.lastViewedAt ?? null,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function getNoteDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const noteId = parseInt(req.params.noteId as string, 10);
    if (isNaN(noteId)) throw new AppError(400, 'Invalid note ID');
    const userId = (req as AuthRequest).userId;

    const note = await db.query.notes.findFirst({
      where: and(eq(notes.id, noteId), eq(notes.isPublished, true)),
    });
    if (!note) throw new AppError(404, 'Note not found');

    const progress = await db.query.userNoteProgress.findFirst({
      where: and(eq(userNoteProgress.userId, userId), eq(userNoteProgress.noteId, noteId)),
    });

    res.json({
      data: {
        ...note,
        isRead: progress?.isRead ?? false,
        lastViewedAt: progress?.lastViewedAt ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function markNoteViewed(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const noteId = parseInt(req.params.noteId as string, 10);
    if (isNaN(noteId)) throw new AppError(400, 'Invalid note ID');
    const userId = (req as AuthRequest).userId;

    const note = await db.query.notes.findFirst({
      where: and(eq(notes.id, noteId), eq(notes.isPublished, true)),
      columns: { id: true },
    });
    if (!note) throw new AppError(404, 'Note not found');

    await db
      .insert(userNoteProgress)
      .values({ userId, noteId, isRead: true, lastViewedAt: new Date() })
      .onConflictDoUpdate({
        target: [userNoteProgress.userId, userNoteProgress.noteId],
        set: { isRead: true, lastViewedAt: new Date() },
      });

    res.json({ data: { noteId, isRead: true } });
  } catch (err) {
    next(err);
  }
}
