import { asc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { classes, subjects, chapters, questions } from '../db/schema';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// ─── Classes ──────────────────────────────────────────────────────────────────

export async function listClasses() {
  return db.select().from(classes).orderBy(asc(classes.order));
}

export async function createClass(data: { name: string; order: number }) {
  const existing = await db.query.classes.findFirst({ where: eq(classes.name, data.name) });
  if (existing) throw new AppError(409, `Class "${data.name}" already exists`);

  const [cls] = await db.insert(classes).values(data).returning();
  logger.info('Class created', { classId: cls.id, name: cls.name });
  return cls;
}

export async function updateClass(id: number, data: { name?: string; order?: number }) {
  const existing = await db.query.classes.findFirst({ where: eq(classes.id, id) });
  if (!existing) throw new AppError(404, 'Class not found');

  const [updated] = await db
    .update(classes)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.order !== undefined && { order: data.order }),
    })
    .where(eq(classes.id, id))
    .returning();

  logger.info('Class updated', { classId: id });
  return updated;
}

export async function deleteClass(id: number, force = false): Promise<void> {
  const existing = await db.query.classes.findFirst({ where: eq(classes.id, id) });
  if (!existing) throw new AppError(404, 'Class not found');

  const [{ subjectCount }] = await db
    .select({ subjectCount: sql<number>`COUNT(*)` })
    .from(subjects)
    .where(eq(subjects.classId, id));

  if (Number(subjectCount) > 0 && !force) {
    throw new AppError(
      409,
      `Class has ${subjectCount} subject(s). Pass ?force=true to delete with all dependants.`,
    );
  }

  await db.delete(classes).where(eq(classes.id, id));
  logger.info('Class deleted', { classId: id });
}

// ─── Subjects ─────────────────────────────────────────────────────────────────

export async function listSubjects(classId?: number) {
  return db
    .select({ subject: subjects, className: classes.name })
    .from(subjects)
    .leftJoin(classes, eq(subjects.classId, classes.id))
    .where(classId ? eq(subjects.classId, classId) : undefined)
    .orderBy(asc(subjects.id));
}

export async function createSubject(data: {
  classId: number;
  name: string;
  nameBn?: string | null;
  description?: string | null;
  iconUrl?: string | null;
}) {
  const cls = await db.query.classes.findFirst({ where: eq(classes.id, data.classId) });
  if (!cls) throw new AppError(404, `Class ${data.classId} not found`);

  const [subject] = await db
    .insert(subjects)
    .values({
      classId: data.classId,
      name: data.name,
      nameBn: data.nameBn ?? null,
      description: data.description ?? null,
      iconUrl: data.iconUrl ?? null,
    })
    .returning();

  logger.info('Subject created', { subjectId: subject.id, name: subject.name });
  return subject;
}

export async function updateSubject(
  id: number,
  data: { name?: string; nameBn?: string | null; description?: string | null; iconUrl?: string | null },
) {
  const existing = await db.query.subjects.findFirst({ where: eq(subjects.id, id) });
  if (!existing) throw new AppError(404, 'Subject not found');

  const [updated] = await db
    .update(subjects)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.nameBn !== undefined && { nameBn: data.nameBn ?? null }),
      ...(data.description !== undefined && { description: data.description ?? null }),
      ...(data.iconUrl !== undefined && { iconUrl: data.iconUrl ?? null }),
    })
    .where(eq(subjects.id, id))
    .returning();

  logger.info('Subject updated', { subjectId: id });
  return updated;
}

export async function deleteSubject(id: number, force = false): Promise<void> {
  const existing = await db.query.subjects.findFirst({ where: eq(subjects.id, id) });
  if (!existing) throw new AppError(404, 'Subject not found');

  const [{ chapterCount }] = await db
    .select({ chapterCount: sql<number>`COUNT(*)` })
    .from(chapters)
    .where(eq(chapters.subjectId, id));

  if (Number(chapterCount) > 0 && !force) {
    throw new AppError(
      409,
      `Subject has ${chapterCount} chapter(s). Pass ?force=true to delete with all dependants.`,
    );
  }

  await db.delete(subjects).where(eq(subjects.id, id));
  logger.info('Subject deleted', { subjectId: id });
}

// ─── Chapters ─────────────────────────────────────────────────────────────────

export async function listChapters(subjectId?: number) {
  return db
    .select({ chapter: chapters, subjectName: subjects.name })
    .from(chapters)
    .leftJoin(subjects, eq(chapters.subjectId, subjects.id))
    .where(subjectId ? eq(chapters.subjectId, subjectId) : undefined)
    .orderBy(asc(chapters.subjectId), asc(chapters.order));
}

export async function createChapter(data: {
  subjectId: number;
  name: string;
  nameBn?: string | null;
  order?: number;
}) {
  const subject = await db.query.subjects.findFirst({ where: eq(subjects.id, data.subjectId) });
  if (!subject) throw new AppError(404, `Subject ${data.subjectId} not found`);

  const [chapter] = await db
    .insert(chapters)
    .values({
      subjectId: data.subjectId,
      name: data.name,
      nameBn: data.nameBn ?? null,
      order: data.order ?? 0,
    })
    .returning();

  logger.info('Chapter created', { chapterId: chapter.id, name: chapter.name });
  return chapter;
}

export async function updateChapter(
  id: number,
  data: { name?: string; nameBn?: string | null; order?: number },
) {
  const existing = await db.query.chapters.findFirst({ where: eq(chapters.id, id) });
  if (!existing) throw new AppError(404, 'Chapter not found');

  const [updated] = await db
    .update(chapters)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.nameBn !== undefined && { nameBn: data.nameBn ?? null }),
      ...(data.order !== undefined && { order: data.order }),
    })
    .where(eq(chapters.id, id))
    .returning();

  logger.info('Chapter updated', { chapterId: id });
  return updated;
}

export async function deleteChapter(id: number, force = false): Promise<void> {
  const existing = await db.query.chapters.findFirst({ where: eq(chapters.id, id) });
  if (!existing) throw new AppError(404, 'Chapter not found');

  const [{ questionCount }] = await db
    .select({ questionCount: sql<number>`COUNT(*)` })
    .from(questions)
    .where(eq(questions.chapterId, id));

  if (Number(questionCount) > 0 && !force) {
    throw new AppError(
      409,
      `Chapter has ${questionCount} question(s). Pass ?force=true to delete with all dependants.`,
    );
  }

  await db.delete(chapters).where(eq(chapters.id, id));
  logger.info('Chapter deleted', { chapterId: id });
}
