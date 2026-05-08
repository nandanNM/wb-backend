import { and, asc, desc, eq, ilike, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  tests,
  testQuestions,
  testAttempts,
  questions,
  questionTranslations,
  questionOptions,
  subjects,
  chapters,
  user,
} from '../db/schema';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TestType = 'chapter_test' | 'subject_test';

export interface CreateTestInput {
  title: string;
  titleBn?: string | null;
  type: TestType;
  subjectId?: number | null;
  chapterId?: number | null;
  durationMinutes: number;
  passingScore?: number | null;
  isActive: boolean;
  questionIds?: number[];
}

export type UpdateTestInput = Partial<Omit<CreateTestInput, 'questionIds'>>;

export interface ListTestsInput {
  page: number;
  limit: number;
  type?: TestType;
  subjectId?: number;
  chapterId?: number;
  isActive?: boolean;
  search?: string;
  sortBy?: 'createdAt' | 'totalPoints' | 'durationMinutes';
  sortOrder?: 'asc' | 'desc';
}

export interface AddQuestionsInput {
  questions: { questionId: number; order: number }[];
}

export interface ReorderInput {
  orders: { questionId: number; order: number }[];
}

export interface ListAttemptsInput {
  page: number;
  limit: number;
  status?: 'in_progress' | 'completed' | 'abandoned';
}

// ─── Internal helper — recalculate totalPoints from linked questions ──────────

async function recalculateTotalPoints(
  testId: number,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db = db,
): Promise<void> {
  const [result] = await (tx as typeof db)
    .select({ total: sql<number>`COALESCE(SUM(${questions.points}), 0)` })
    .from(testQuestions)
    .innerJoin(questions, eq(testQuestions.questionId, questions.id))
    .where(eq(testQuestions.testId, testId));

  await (tx as typeof db)
    .update(tests)
    .set({ totalPoints: Number(result?.total ?? 0) })
    .where(eq(tests.id, testId));
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createTest(data: CreateTestInput) {
  logger.info('Creating test', { type: data.type, title: data.title });

  return db.transaction(async (tx) => {
    const [test] = await tx
      .insert(tests)
      .values({
        title: data.title,
        titleBn: data.titleBn ?? null,
        type: data.type,
        subjectId: data.subjectId ?? null,
        chapterId: data.chapterId ?? null,
        durationMinutes: data.durationMinutes,
        totalPoints: 0,
        passingScore: data.passingScore ?? null,
        isActive: data.isActive,
      })
      .returning();

    if (data.questionIds && data.questionIds.length > 0) {
      // Validate all question IDs exist
      const found = await tx
        .select({ id: questions.id })
        .from(questions)
        .where(inArray(questions.id, data.questionIds));

      const foundIds = new Set(found.map((q) => q.id));
      const missing = data.questionIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        throw new AppError(400, `Question IDs not found: ${missing.join(', ')}`);
      }

      await tx.insert(testQuestions).values(
        data.questionIds.map((questionId, i) => ({
          testId: test.id,
          questionId,
          order: i + 1,
        })),
      );

      await recalculateTotalPoints(test.id, tx);
    }

    logger.info('Test created', { testId: test.id });
    return getTestById(test.id);
  });
}

// ─── Get single ───────────────────────────────────────────────────────────────

export async function getTestById(id: number) {
  const test = await db.query.tests.findFirst({ where: eq(tests.id, id) });
  if (!test) throw new AppError(404, 'Test not found');

  const testQs = await db
    .select({ order: testQuestions.order, q: questions })
    .from(testQuestions)
    .innerJoin(questions, eq(testQuestions.questionId, questions.id))
    .where(eq(testQuestions.testId, id))
    .orderBy(asc(testQuestions.order));

  const qIds = testQs.map((r) => r.q.id);

  const [translations, options] = qIds.length
    ? await Promise.all([
        db.select().from(questionTranslations).where(inArray(questionTranslations.questionId, qIds)),
        db
          .select()
          .from(questionOptions)
          .where(inArray(questionOptions.questionId, qIds))
          .orderBy(asc(questionOptions.order)),
      ])
    : [[], []];

  const trMap = new Map<number, typeof translations>();
  translations.forEach((t) => {
    if (!trMap.has(t.questionId)) trMap.set(t.questionId, []);
    trMap.get(t.questionId)!.push(t);
  });

  const optMap = new Map<number, typeof options>();
  options.forEach((o) => {
    if (!optMap.has(o.questionId)) optMap.set(o.questionId, []);
    optMap.get(o.questionId)!.push(o);
  });

  return {
    ...test,
    questions: testQs.map(({ order, q }) => ({
      ...q,
      order,
      translations: trMap.get(q.id) ?? [],
      options: optMap.get(q.id) ?? [], // isCorrect included — admin view
    })),
  };
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listTests(filters: ListTestsInput) {
  const {
    page, limit, type, subjectId, chapterId, isActive,
    search, sortBy = 'createdAt', sortOrder = 'desc',
  } = filters;
  const offset = (page - 1) * limit;

  const whereClause = and(
    type ? eq(tests.type, type) : undefined,
    subjectId ? eq(tests.subjectId, subjectId) : undefined,
    chapterId ? eq(tests.chapterId, chapterId) : undefined,
    isActive !== undefined ? eq(tests.isActive, isActive) : undefined,
    search ? ilike(tests.title, `%${search}%`) : undefined,
  );

  const orderCol =
    sortBy === 'totalPoints' ? tests.totalPoints
    : sortBy === 'durationMinutes' ? tests.durationMinutes
    : tests.createdAt;
  const orderFn = sortOrder === 'asc' ? asc : desc;

  const [countResult, rows] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)` })
      .from(tests)
      .where(whereClause),

    db
      .select({
        test: tests,
        subjectName: subjects.name,
        chapterName: chapters.name,
        questionCount: sql<number>`(
          SELECT COUNT(*) FROM test_questions WHERE test_id = ${tests.id}
        )`,
        completedAttempts: sql<number>`(
          SELECT COUNT(*) FROM test_attempts
          WHERE test_id = ${tests.id} AND status = 'completed'
        )`,
      })
      .from(tests)
      .leftJoin(subjects, eq(tests.subjectId, subjects.id))
      .leftJoin(chapters, eq(tests.chapterId, chapters.id))
      .where(whereClause)
      .orderBy(orderFn(orderCol))
      .limit(limit)
      .offset(offset),
  ]);

  const total = Number(countResult[0]?.total ?? 0);

  return {
    data: rows,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateTest(id: number, data: UpdateTestInput) {
  logger.info('Updating test', { testId: id });

  const existing = await db.query.tests.findFirst({ where: eq(tests.id, id) });
  if (!existing) throw new AppError(404, 'Test not found');

  const [updated] = await db
    .update(tests)
    .set({
      ...(data.title !== undefined && { title: data.title }),
      ...(data.titleBn !== undefined && { titleBn: data.titleBn ?? null }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.subjectId !== undefined && { subjectId: data.subjectId ?? null }),
      ...(data.chapterId !== undefined && { chapterId: data.chapterId ?? null }),
      ...(data.durationMinutes !== undefined && { durationMinutes: data.durationMinutes }),
      ...(data.passingScore !== undefined && { passingScore: data.passingScore ?? null }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    })
    .where(eq(tests.id, id))
    .returning();

  logger.info('Test updated', { testId: id });
  return updated;
}

// ─── Delete (soft) ────────────────────────────────────────────────────────────

export async function deleteTest(id: number): Promise<void> {
  const existing = await db.query.tests.findFirst({ where: eq(tests.id, id) });
  if (!existing) throw new AppError(404, 'Test not found');

  await db.update(tests).set({ isActive: false }).where(eq(tests.id, id));
  logger.info('Test soft-deleted', { testId: id });
}

// ─── Add questions to test ────────────────────────────────────────────────────

export async function addQuestionsToTest(testId: number, input: AddQuestionsInput) {
  const test = await db.query.tests.findFirst({ where: eq(tests.id, testId) });
  if (!test) throw new AppError(404, 'Test not found');

  const questionIds = input.questions.map((q) => q.questionId);

  const found = await db
    .select({ id: questions.id })
    .from(questions)
    .where(inArray(questions.id, questionIds));
  const foundIds = new Set(found.map((q) => q.id));
  const missing = questionIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new AppError(400, `Question IDs not found: ${missing.join(', ')}`);
  }

  // Upsert: insert new, ignore existing (keep current order for duplicates)
  await db.transaction(async (tx) => {
    await tx
      .insert(testQuestions)
      .values(input.questions.map((q) => ({ testId, questionId: q.questionId, order: q.order })))
      .onConflictDoNothing({ target: [testQuestions.testId, testQuestions.questionId] });

    await recalculateTotalPoints(testId, tx);
  });

  logger.info('Questions added to test', { testId, count: input.questions.length });
}

// ─── Remove question from test ────────────────────────────────────────────────

export async function removeQuestionFromTest(testId: number, questionId: number): Promise<void> {
  const row = await db.query.testQuestions.findFirst({
    where: and(eq(testQuestions.testId, testId), eq(testQuestions.questionId, questionId)),
  });
  if (!row) throw new AppError(404, 'Question not found in this test');

  await db.transaction(async (tx) => {
    await tx
      .delete(testQuestions)
      .where(and(eq(testQuestions.testId, testId), eq(testQuestions.questionId, questionId)));

    await recalculateTotalPoints(testId, tx);
  });

  logger.info('Question removed from test', { testId, questionId });
}

// ─── Reorder questions ────────────────────────────────────────────────────────

export async function reorderTestQuestions(testId: number, input: ReorderInput): Promise<void> {
  const test = await db.query.tests.findFirst({ where: eq(tests.id, testId) });
  if (!test) throw new AppError(404, 'Test not found');

  await db.transaction(async (tx) => {
    for (const { questionId, order } of input.orders) {
      await tx
        .update(testQuestions)
        .set({ order })
        .where(and(eq(testQuestions.testId, testId), eq(testQuestions.questionId, questionId)));
    }
  });

  logger.info('Test questions reordered', { testId });
}

// ─── Attempts list (admin analytics) ─────────────────────────────────────────

export async function getTestAttempts(testId: number, filters: ListAttemptsInput) {
  const { page, limit, status } = filters;
  const offset = (page - 1) * limit;

  const test = await db.query.tests.findFirst({ where: eq(tests.id, testId) });
  if (!test) throw new AppError(404, 'Test not found');

  const whereClause = and(
    eq(testAttempts.testId, testId),
    status ? eq(testAttempts.status, status) : undefined,
  );

  const [countResult, rows] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(testAttempts).where(whereClause),

    db
      .select({
        attempt: testAttempts,
        studentName: user.name,
        studentEmail: user.email,
      })
      .from(testAttempts)
      .innerJoin(user, eq(testAttempts.studentId, user.id))
      .where(whereClause)
      .orderBy(desc(testAttempts.startedAt))
      .limit(limit)
      .offset(offset),
  ]);

  const total = Number(countResult[0]?.total ?? 0);

  return {
    data: rows,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

// ─── Test statistics ──────────────────────────────────────────────────────────

export async function getTestStats(testId: number) {
  const test = await db.query.tests.findFirst({ where: eq(tests.id, testId) });
  if (!test) throw new AppError(404, 'Test not found');

  const [stats] = await db
    .select({
      totalAttempts: sql<number>`COUNT(*)`,
      completedAttempts: sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`,
      abandonedAttempts: sql<number>`COUNT(*) FILTER (WHERE status = 'abandoned')`,
      avgScore: sql<number>`ROUND(AVG(score) FILTER (WHERE status = 'completed'), 2)`,
      avgXp: sql<number>`ROUND(AVG(xp_earned) FILTER (WHERE status = 'completed'), 2)`,
      highestScore: sql<number>`MAX(score) FILTER (WHERE status = 'completed')`,
      lowestScore: sql<number>`MIN(score) FILTER (WHERE status = 'completed')`,
      passCount: sql<number>`COUNT(*) FILTER (WHERE status = 'completed' AND score >= ${test.passingScore ?? 0})`,
    })
    .from(testAttempts)
    .where(eq(testAttempts.testId, testId));

  const [questionCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(testQuestions)
    .where(eq(testQuestions.testId, testId));

  const completed = Number(stats.completedAttempts ?? 0);
  const total = Number(stats.totalAttempts ?? 0);

  return {
    testId,
    title: test.title,
    totalPoints: test.totalPoints,
    passingScore: test.passingScore,
    questionCount: Number(questionCount.count ?? 0),
    attempts: {
      total,
      completed,
      abandoned: Number(stats.abandonedAttempts ?? 0),
      inProgress: total - completed - Number(stats.abandonedAttempts ?? 0),
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      passRate:
        completed > 0 && test.passingScore != null
          ? Math.round((Number(stats.passCount ?? 0) / completed) * 100)
          : null,
    },
    scores: {
      average: stats.avgScore ? Number(stats.avgScore) : null,
      highest: stats.highestScore ? Number(stats.highestScore) : null,
      lowest: stats.lowestScore ? Number(stats.lowestScore) : null,
      averageXp: stats.avgXp ? Number(stats.avgXp) : null,
    },
  };
}
