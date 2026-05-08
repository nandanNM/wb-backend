import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  questions,
  questionTranslations,
  questionOptions,
  chapters,
} from '../db/schema';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuestionStatus = 'draft' | 'published' | 'archived';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Language = 'en' | 'bn';
export type OptionKey = 'A' | 'B' | 'C' | 'D';

export interface OptionInput {
  optionKey: OptionKey;
  textEn: string;
  textBn?: string | null;
  isCorrect: boolean;
  imageUrl?: string | null;
  order: number;
}

export interface TranslationInput {
  language: Language;
  text: string;
  explanation?: string | null;
}

export interface CreateQuestionInput {
  chapterId: number;
  difficulty: Difficulty;
  points: number;
  status: QuestionStatus;
  category?: string | null;
  tags: string[];
  imageUrl?: string | null;
  translations: TranslationInput[];
  options: OptionInput[];
}

export type UpdateQuestionInput = Partial<CreateQuestionInput>;

export interface ListQuestionsInput {
  page: number;
  limit: number;
  chapterId?: number;
  subjectId?: number;
  difficulty?: Difficulty;
  status?: QuestionStatus;
  category?: string;
  search?: string;
  tags?: string[];
  sortBy?: 'createdAt' | 'points';
  sortOrder?: 'asc' | 'desc';
}

// ─── Duplicate detection ──────────────────────────────────────────────────────

export async function checkDuplicate(chapterId: number, textEn: string): Promise<number | null> {
  const rows = await db
    .select({ questionId: questionTranslations.questionId })
    .from(questionTranslations)
    .innerJoin(questions, eq(questionTranslations.questionId, questions.id))
    .where(
      and(
        eq(questions.chapterId, chapterId),
        eq(questionTranslations.language, 'en'),
        eq(questionTranslations.text, textEn),
      ),
    )
    .limit(1);

  return rows.length > 0 ? rows[0].questionId : null;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createQuestion(data: CreateQuestionInput) {
  logger.info('Creating question', { chapterId: data.chapterId, status: data.status });

  return db.transaction(async (tx) => {
    const [q] = await tx
      .insert(questions)
      .values({
        chapterId: data.chapterId,
        difficulty: data.difficulty,
        points: data.points,
        status: data.status,
        category: data.category ?? null,
        tags: data.tags,
        imageUrl: data.imageUrl ?? null,
      })
      .returning();

    const [insertedTranslations, insertedOptions] = await Promise.all([
      tx
        .insert(questionTranslations)
        .values(
          data.translations.map((t) => ({
            questionId: q.id,
            language: t.language,
            text: t.text,
            explanation: t.explanation ?? null,
          })),
        )
        .returning(),

      tx
        .insert(questionOptions)
        .values(
          data.options.map((o) => ({
            questionId: q.id,
            optionKey: o.optionKey,
            textEn: o.textEn,
            textBn: o.textBn ?? null,
            isCorrect: o.isCorrect,
            imageUrl: o.imageUrl ?? null,
            order: o.order,
          })),
        )
        .returning(),
    ]);

    logger.info('Question created', { questionId: q.id });
    return { ...q, translations: insertedTranslations, options: insertedOptions };
  });
}

// ─── Read single ──────────────────────────────────────────────────────────────

export async function getQuestionById(id: number) {
  const q = await db.query.questions.findFirst({
    where: eq(questions.id, id),
  });
  if (!q) throw new AppError(404, 'Question not found');

  const [translations, options] = await Promise.all([
    db
      .select()
      .from(questionTranslations)
      .where(eq(questionTranslations.questionId, id)),
    db
      .select()
      .from(questionOptions)
      .where(eq(questionOptions.questionId, id))
      .orderBy(asc(questionOptions.order)),
  ]);

  return { ...q, translations, options };
}

// ─── List (paginated + filtered + searched) ───────────────────────────────────

export async function listQuestions(filters: ListQuestionsInput) {
  const {
    page, limit, chapterId, subjectId, difficulty, status,
    category, search, tags, sortBy = 'createdAt', sortOrder = 'desc',
  } = filters;
  const offset = (page - 1) * limit;

  const tagConditions = tags?.length
    ? tags.map((tag) => sql`${tag} = ANY(${questions.tags})`)
    : [];

  const whereClause = and(
    chapterId ? eq(questions.chapterId, chapterId) : undefined,
    difficulty ? eq(questions.difficulty, difficulty) : undefined,
    status ? eq(questions.status, status) : undefined,
    category ? ilike(questions.category, `%${category}%`) : undefined,
    subjectId ? eq(chapters.subjectId, subjectId) : undefined,
    search ? ilike(questionTranslations.text, `%${search}%`) : undefined,
    tagConditions.length ? or(...tagConditions) : undefined,
  );

  const orderCol = sortBy === 'points' ? questions.points : questions.createdAt;
  const orderFn = sortOrder === 'asc' ? asc : desc;

  const baseJoins = (qb: typeof db) =>
    qb
      .select({
        question: questions,
        textEn: questionTranslations.text,
        chapterName: chapters.name,
      })
      .from(questions)
      .leftJoin(
        questionTranslations,
        and(
          eq(questionTranslations.questionId, questions.id),
          eq(questionTranslations.language, 'en'),
        ),
      )
      .leftJoin(chapters, eq(questions.chapterId, chapters.id));

  const [countResult, rows] = await Promise.all([
    db
      .select({ total: sql<number>`count(distinct ${questions.id})` })
      .from(questions)
      .leftJoin(
        questionTranslations,
        and(
          eq(questionTranslations.questionId, questions.id),
          eq(questionTranslations.language, 'en'),
        ),
      )
      .leftJoin(chapters, eq(questions.chapterId, chapters.id))
      .where(whereClause),

    baseJoins(db as typeof db)
      .where(whereClause)
      .orderBy(orderFn(orderCol))
      .limit(limit)
      .offset(offset),
  ]);

  const total = Number(countResult[0]?.total ?? 0);

  return {
    data: rows,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateQuestion(id: number, data: UpdateQuestionInput) {
  logger.info('Updating question', { questionId: id });

  return db.transaction(async (tx) => {
    const existing = await tx.query.questions.findFirst({ where: eq(questions.id, id) });
    if (!existing) throw new AppError(404, 'Question not found');

    const baseFields: Partial<typeof questions.$inferInsert> = { updatedAt: new Date() };
    if (data.chapterId !== undefined) baseFields.chapterId = data.chapterId;
    if (data.difficulty !== undefined) baseFields.difficulty = data.difficulty;
    if (data.points !== undefined) baseFields.points = data.points;
    if (data.status !== undefined) baseFields.status = data.status;
    if (data.category !== undefined) baseFields.category = data.category ?? null;
    if (data.tags !== undefined) baseFields.tags = data.tags;
    if (data.imageUrl !== undefined) baseFields.imageUrl = data.imageUrl ?? null;

    const [updated] = await tx
      .update(questions)
      .set(baseFields)
      .where(eq(questions.id, id))
      .returning();

    let updatedTranslations = await tx
      .select()
      .from(questionTranslations)
      .where(eq(questionTranslations.questionId, id));

    if (data.translations !== undefined) {
      await tx.delete(questionTranslations).where(eq(questionTranslations.questionId, id));
      updatedTranslations = await tx
        .insert(questionTranslations)
        .values(
          data.translations.map((t) => ({
            questionId: id,
            language: t.language,
            text: t.text,
            explanation: t.explanation ?? null,
          })),
        )
        .returning();
    }

    let updatedOptions = await tx
      .select()
      .from(questionOptions)
      .where(eq(questionOptions.questionId, id))
      .orderBy(asc(questionOptions.order));

    if (data.options !== undefined) {
      await tx.delete(questionOptions).where(eq(questionOptions.questionId, id));
      updatedOptions = await tx
        .insert(questionOptions)
        .values(
          data.options.map((o) => ({
            questionId: id,
            optionKey: o.optionKey,
            textEn: o.textEn,
            textBn: o.textBn ?? null,
            isCorrect: o.isCorrect,
            imageUrl: o.imageUrl ?? null,
            order: o.order,
          })),
        )
        .returning();
    }

    logger.info('Question updated', { questionId: id });
    return { ...updated, translations: updatedTranslations, options: updatedOptions };
  });
}

// ─── Delete (soft) ────────────────────────────────────────────────────────────

export async function deleteQuestion(id: number): Promise<void> {
  logger.info('Soft-deleting question', { questionId: id });

  const existing = await db.query.questions.findFirst({ where: eq(questions.id, id) });
  if (!existing) throw new AppError(404, 'Question not found');

  await db
    .update(questions)
    .set({ isActive: false, status: 'archived', updatedAt: new Date() })
    .where(eq(questions.id, id));

  logger.info('Question deleted', { questionId: id });
}
