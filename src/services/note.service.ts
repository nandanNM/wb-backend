import { and, asc, desc, eq, ilike, sql } from 'drizzle-orm';
import { db } from '../db';
import { notes, subjects, chapters, user, userNoteProgress } from '../db/schema';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateNoteInput {
  title: string;
  titleBn?: string | null;
  subjectId?: number | null;
  chapterId?: number | null;
  pdfUrl: string;
  fileSizeBytes?: number | null;
  pageCount?: number | null;
  description?: string | null;
  isPublished: boolean;
  uploadedBy: string;
}

export type UpdateNoteInput = Partial<Omit<CreateNoteInput, 'uploadedBy'>>;

export interface ListNotesInput {
  page: number;
  limit: number;
  subjectId?: number;
  chapterId?: number;
  isPublished?: boolean;
  search?: string;
  sortBy?: 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createNote(data: CreateNoteInput) {
  logger.info('Creating note', { title: data.title, uploadedBy: data.uploadedBy });

  const [note] = await db
    .insert(notes)
    .values({
      title: data.title,
      titleBn: data.titleBn ?? null,
      subjectId: data.subjectId ?? null,
      chapterId: data.chapterId ?? null,
      pdfUrl: data.pdfUrl,
      fileSizeBytes: data.fileSizeBytes ?? null,
      pageCount: data.pageCount ?? null,
      description: data.description ?? null,
      isPublished: data.isPublished,
      uploadedBy: data.uploadedBy,
    })
    .returning();

  logger.info('Note created', { noteId: note.id });
  return note;
}

// ─── Get single (admin — no isPublished filter) ───────────────────────────────

export async function getNoteById(id: number) {
  const note = await db.query.notes.findFirst({ where: eq(notes.id, id) });
  if (!note) throw new AppError(404, 'Note not found');

  const [readerCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(userNoteProgress)
    .where(eq(userNoteProgress.noteId, id));

  return { ...note, readerCount: Number(readerCount?.count ?? 0) };
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listNotes(filters: ListNotesInput) {
  const {
    page, limit, subjectId, chapterId, isPublished,
    search, sortBy = 'createdAt', sortOrder = 'desc',
  } = filters;
  const offset = (page - 1) * limit;

  const whereClause = and(
    subjectId ? eq(notes.subjectId, subjectId) : undefined,
    chapterId ? eq(notes.chapterId, chapterId) : undefined,
    isPublished !== undefined ? eq(notes.isPublished, isPublished) : undefined,
    search ? ilike(notes.title, `%${search}%`) : undefined,
  );

  const orderCol = sortBy === 'title' ? notes.title : notes.createdAt;
  const orderFn = sortOrder === 'asc' ? asc : desc;

  const [countResult, rows] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(notes).where(whereClause),

    db
      .select({
        note: notes,
        subjectName: subjects.name,
        chapterName: chapters.name,
        uploaderName: user.name,
      })
      .from(notes)
      .leftJoin(subjects, eq(notes.subjectId, subjects.id))
      .leftJoin(chapters, eq(notes.chapterId, chapters.id))
      .leftJoin(user, eq(notes.uploadedBy, user.id))
      .where(whereClause)
      .orderBy(orderFn(orderCol))
      .limit(limit)
      .offset(offset),
  ]);

  const total = Number(countResult[0]?.total ?? 0);
  return { data: rows, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateNote(id: number, data: UpdateNoteInput) {
  const existing = await db.query.notes.findFirst({ where: eq(notes.id, id) });
  if (!existing) throw new AppError(404, 'Note not found');

  const [updated] = await db
    .update(notes)
    .set({
      ...(data.title !== undefined && { title: data.title }),
      ...(data.titleBn !== undefined && { titleBn: data.titleBn ?? null }),
      ...(data.subjectId !== undefined && { subjectId: data.subjectId ?? null }),
      ...(data.chapterId !== undefined && { chapterId: data.chapterId ?? null }),
      ...(data.pdfUrl !== undefined && { pdfUrl: data.pdfUrl }),
      ...(data.fileSizeBytes !== undefined && { fileSizeBytes: data.fileSizeBytes ?? null }),
      ...(data.pageCount !== undefined && { pageCount: data.pageCount ?? null }),
      ...(data.description !== undefined && { description: data.description ?? null }),
      ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
      updatedAt: new Date(),
    })
    .where(eq(notes.id, id))
    .returning();

  logger.info('Note updated', { noteId: id });
  return updated;
}

// ─── Publish / Unpublish ──────────────────────────────────────────────────────

export async function setNotePublished(id: number, isPublished: boolean) {
  const existing = await db.query.notes.findFirst({ where: eq(notes.id, id) });
  if (!existing) throw new AppError(404, 'Note not found');

  const [updated] = await db
    .update(notes)
    .set({ isPublished, updatedAt: new Date() })
    .where(eq(notes.id, id))
    .returning();

  logger.info(`Note ${isPublished ? 'published' : 'unpublished'}`, { noteId: id });
  return updated;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteNote(id: number): Promise<void> {
  const existing = await db.query.notes.findFirst({ where: eq(notes.id, id) });
  if (!existing) throw new AppError(404, 'Note not found');

  await db.delete(notes).where(eq(notes.id, id));
  logger.info('Note deleted', { noteId: id });
}
