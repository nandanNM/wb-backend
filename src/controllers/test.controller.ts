import { Request, Response, NextFunction } from 'express';
import { eq, and, asc, desc, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import {
  tests,
  testQuestions,
  testAttempts,
  testAttemptAnswers,
  questions,
  questionTranslations,
  questionOptions,
  userXp,
  xpTransactions,
  dailyActivity,
  userStreaks,
} from '../db/schema';
import { AppError } from '../middleware/errorHandler';
import { validate } from '../lib/validate';
import type { AuthRequest } from '../middleware/requireAuth';

const BASE_XP = 50;
const PERFECT_BONUS_XP = 50;

type XpReason =
  | 'test_completion'
  | 'perfect_score'
  | 'streak_bonus'
  | 'achievement_unlock'
  | 'challenge_completion'
  | 'referral_bonus'
  | 'daily_login';

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function updateStreak(userId: string, today: string): Promise<void> {
  const streak = await db.query.userStreaks.findFirst({
    where: eq(userStreaks.userId, userId),
  });

  if (!streak) {
    await db.insert(userStreaks).values({
      userId,
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: today,
    });
    return;
  }

  if (streak.lastActivityDate === today) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const newStreak = streak.lastActivityDate === yesterdayStr ? streak.currentStreak + 1 : 1;
  const longestStreak = Math.max(streak.longestStreak, newStreak);

  await db
    .update(userStreaks)
    .set({ currentStreak: newStreak, longestStreak, lastActivityDate: today, updatedAt: new Date() })
    .where(eq(userStreaks.userId, userId));
}

async function awardXp(
  userId: string,
  amount: number,
  reason: XpReason,
  referenceId?: string,
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  await Promise.all([
    db.insert(xpTransactions).values({ userId, amount, reason, referenceId }),

    db
      .insert(userXp)
      .values({ userId, totalXp: amount, weeklyXp: amount, monthlyXp: amount, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userXp.userId,
        set: {
          totalXp: sql`${userXp.totalXp} + ${amount}`,
          weeklyXp: sql`${userXp.weeklyXp} + ${amount}`,
          monthlyXp: sql`${userXp.monthlyXp} + ${amount}`,
          updatedAt: new Date(),
        },
      }),

    db
      .insert(dailyActivity)
      .values({
        userId,
        date: today,
        xpEarned: amount,
        activityCount: 1,
        testsCompleted: reason === 'test_completion' ? 1 : 0,
      })
      .onConflictDoUpdate({
        target: [dailyActivity.userId, dailyActivity.date],
        set: {
          xpEarned: sql`${dailyActivity.xpEarned} + ${amount}`,
          activityCount: sql`${dailyActivity.activityCount} + 1`,
          testsCompleted:
            reason === 'test_completion'
              ? sql`${dailyActivity.testsCompleted} + 1`
              : dailyActivity.testsCompleted,
        },
      }),
  ]);

  await updateStreak(userId, today);
}

// Returns true if the test is locked for the user (sequential locking within a chapter)
async function isChapterTestLocked(
  testId: number,
  chapterId: number,
  userId: string,
): Promise<boolean> {
  const chapterTests = await db
    .select({ id: tests.id })
    .from(tests)
    .where(and(eq(tests.chapterId, chapterId), eq(tests.isActive, true)))
    .orderBy(asc(tests.id));

  const idx = chapterTests.findIndex((t) => t.id === testId);
  if (idx <= 0) return false; // first test or not found → unlocked

  const prevId = chapterTests[idx - 1].id;
  const done = await db.query.testAttempts.findFirst({
    where: and(
      eq(testAttempts.testId, prevId),
      eq(testAttempts.studentId, userId),
      eq(testAttempts.status, 'completed'),
    ),
    columns: { id: true },
  });

  return !done;
}

// ─── Controllers ──────────────────────────────────────────────────────────────

export async function getChapterTests(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const chapterId = parseInt(req.params.chapterId as string, 10);
    if (isNaN(chapterId)) throw new AppError(400, 'Invalid chapter ID');
    const userId = (req as AuthRequest).userId;

    const testList = await db
      .select()
      .from(tests)
      .where(and(eq(tests.chapterId, chapterId), eq(tests.isActive, true)))
      .orderBy(asc(tests.id));

    if (!testList.length) {
      res.json({ data: [] });
      return;
    }

    const testIds = testList.map((t) => t.id);
    const completedRows = await db
      .select({ testId: testAttempts.testId })
      .from(testAttempts)
      .where(
        and(
          inArray(testAttempts.testId, testIds),
          eq(testAttempts.studentId, userId),
          eq(testAttempts.status, 'completed'),
        ),
      );

    const completedSet = new Set(completedRows.map((r) => r.testId));

    res.json({
      data: testList.map((test, i) => ({
        ...test,
        isLocked: i === 0 ? false : !completedSet.has(testList[i - 1].id),
        isCompleted: completedSet.has(test.id),
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function getSubjectTests(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const subjectId = parseInt(req.params.subjectId as string, 10);
    if (isNaN(subjectId)) throw new AppError(400, 'Invalid subject ID');
    const userId = (req as AuthRequest).userId;

    const testList = await db
      .select()
      .from(tests)
      .where(
        and(
          eq(tests.subjectId, subjectId),
          eq(tests.type, 'subject_test'),
          eq(tests.isActive, true),
        ),
      )
      .orderBy(asc(tests.id));

    const completedSet = new Set<number>();
    if (testList.length) {
      const rows = await db
        .select({ testId: testAttempts.testId })
        .from(testAttempts)
        .where(
          and(
            inArray(testAttempts.testId, testList.map((t) => t.id)),
            eq(testAttempts.studentId, userId),
            eq(testAttempts.status, 'completed'),
          ),
        );
      rows.forEach((r) => completedSet.add(r.testId));
    }

    res.json({
      data: testList.map((test) => ({
        ...test,
        isLocked: false,
        isCompleted: completedSet.has(test.id),
      })),
    });
  } catch (err) {
    next(err);
  }
}

// Mixed-chapter tests = subject_test type across all subjects
export async function getMixedTests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as AuthRequest).userId;

    const testList = await db
      .select()
      .from(tests)
      .where(and(eq(tests.type, 'subject_test'), eq(tests.isActive, true)))
      .orderBy(asc(tests.id));

    const completedSet = new Set<number>();
    if (testList.length) {
      const rows = await db
        .select({ testId: testAttempts.testId })
        .from(testAttempts)
        .where(
          and(
            inArray(testAttempts.testId, testList.map((t) => t.id)),
            eq(testAttempts.studentId, userId),
            eq(testAttempts.status, 'completed'),
          ),
        );
      rows.forEach((r) => completedSet.add(r.testId));
    }

    res.json({
      data: testList.map((test) => ({
        ...test,
        isLocked: false,
        isCompleted: completedSet.has(test.id),
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function getTestDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = parseInt(req.params.testId as string, 10);
    if (isNaN(testId)) throw new AppError(400, 'Invalid test ID');
    const userId = (req as AuthRequest).userId;

    const test = await db.query.tests.findFirst({
      where: and(eq(tests.id, testId), eq(tests.isActive, true)),
    });
    if (!test) throw new AppError(404, 'Test not found');

    if (test.type === 'chapter_test' && test.chapterId) {
      if (await isChapterTestLocked(testId, test.chapterId, userId)) {
        throw new AppError(403, 'Complete the previous test first to unlock this one');
      }
    }

    const testQs = await db
      .select({ order: testQuestions.order, q: questions })
      .from(testQuestions)
      .innerJoin(questions, eq(testQuestions.questionId, questions.id))
      .where(eq(testQuestions.testId, testId))
      .orderBy(asc(testQuestions.order));

    const qIds = testQs.map((r) => r.q.id);

    const [trs, opts] = await Promise.all([
      qIds.length
        ? db.select().from(questionTranslations).where(inArray(questionTranslations.questionId, qIds))
        : Promise.resolve([]),
      qIds.length
        ? db
            .select()
            .from(questionOptions)
            .where(inArray(questionOptions.questionId, qIds))
            .orderBy(asc(questionOptions.order))
        : Promise.resolve([]),
    ]);

    const trMap = new Map<number, (typeof trs)[number][]>();
    trs.forEach((t) => {
      if (!trMap.has(t.questionId)) trMap.set(t.questionId, []);
      trMap.get(t.questionId)!.push(t);
    });

    const optMap = new Map<number, (typeof opts)[number][]>();
    opts.forEach((o) => {
      if (!optMap.has(o.questionId)) optMap.set(o.questionId, []);
      optMap.get(o.questionId)!.push(o);
    });

    const questionsData = testQs.map(({ order, q }) => ({
      id: q.id,
      chapterId: q.chapterId,
      type: q.type,
      difficulty: q.difficulty,
      points: q.points,
      imageUrl: q.imageUrl,
      order,
      translations: trMap.get(q.id) ?? [],
      // isCorrect is intentionally omitted from options
      options: (optMap.get(q.id) ?? []).map(({ id, optionKey, textEn, textBn, imageUrl, order: o }) => ({
        id,
        optionKey,
        textEn,
        textBn,
        imageUrl,
        order: o,
      })),
    }));

    res.json({ data: { ...test, questions: questionsData } });
  } catch (err) {
    next(err);
  }
}

export async function startTest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = parseInt(req.params.testId as string, 10);
    if (isNaN(testId)) throw new AppError(400, 'Invalid test ID');
    const userId = (req as AuthRequest).userId;

    const test = await db.query.tests.findFirst({
      where: and(eq(tests.id, testId), eq(tests.isActive, true)),
      columns: { id: true, type: true, chapterId: true, totalPoints: true },
    });
    if (!test) throw new AppError(404, 'Test not found');

    if (test.type === 'chapter_test' && test.chapterId) {
      if (await isChapterTestLocked(testId, test.chapterId, userId)) {
        throw new AppError(403, 'Complete the previous test first to unlock this one');
      }
    }

    // Resume an existing in-progress attempt rather than creating a duplicate
    const existing = await db.query.testAttempts.findFirst({
      where: and(
        eq(testAttempts.testId, testId),
        eq(testAttempts.studentId, userId),
        eq(testAttempts.status, 'in_progress'),
      ),
    });

    if (existing) {
      res.json({ data: existing, resumed: true });
      return;
    }

    const [attempt] = await db
      .insert(testAttempts)
      .values({ testId, studentId: userId, totalPoints: test.totalPoints })
      .returning();

    res.status(201).json({ data: attempt, resumed: false });
  } catch (err) {
    next(err);
  }
}

const submitAnswerSchema = z.object({
  questionId: z.number().int().positive(),
  selectedOptionId: z.number().int().positive().nullable().optional(),
  timeTakenSeconds: z.number().int().nonnegative().optional(),
});

export async function submitAnswer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const attemptId = parseInt(req.params.attemptId as string, 10);
    if (isNaN(attemptId)) throw new AppError(400, 'Invalid attempt ID');
    const userId = (req as AuthRequest).userId;
    const body = validate(submitAnswerSchema, req.body);

    const attempt = await db.query.testAttempts.findFirst({
      where: and(eq(testAttempts.id, attemptId), eq(testAttempts.studentId, userId)),
      columns: { id: true, status: true },
    });
    if (!attempt) throw new AppError(404, 'Attempt not found');
    if (attempt.status !== 'in_progress') throw new AppError(400, 'Test is not in progress');

    let isCorrect: boolean | null = null;
    if (body.selectedOptionId != null) {
      const option = await db.query.questionOptions.findFirst({
        where: and(
          eq(questionOptions.id, body.selectedOptionId),
          eq(questionOptions.questionId, body.questionId),
        ),
        columns: { isCorrect: true },
      });
      if (!option) throw new AppError(400, 'Invalid option for this question');
      isCorrect = option.isCorrect;
    }

    await db
      .insert(testAttemptAnswers)
      .values({
        attemptId,
        questionId: body.questionId,
        selectedOptionId: body.selectedOptionId ?? null,
        isCorrect,
        timeTakenSeconds: body.timeTakenSeconds ?? null,
      })
      .onConflictDoUpdate({
        target: [testAttemptAnswers.attemptId, testAttemptAnswers.questionId],
        set: {
          selectedOptionId: body.selectedOptionId ?? null,
          isCorrect,
          timeTakenSeconds: body.timeTakenSeconds ?? null,
        },
      });

    res.json({ data: { isCorrect } });
  } catch (err) {
    next(err);
  }
}

export async function completeTest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const attemptId = parseInt(req.params.attemptId as string, 10);
    if (isNaN(attemptId)) throw new AppError(400, 'Invalid attempt ID');
    const userId = (req as AuthRequest).userId;

    const attempt = await db.query.testAttempts.findFirst({
      where: and(eq(testAttempts.id, attemptId), eq(testAttempts.studentId, userId)),
    });
    if (!attempt) throw new AppError(404, 'Attempt not found');
    if (attempt.status === 'completed') throw new AppError(400, 'Test already completed');
    if (attempt.status !== 'in_progress') throw new AppError(400, 'Test is not in progress');

    const [testData, answers] = await Promise.all([
      db.query.tests.findFirst({
        where: eq(tests.id, attempt.testId),
        columns: { totalPoints: true, passingScore: true },
      }),
      db.select().from(testAttemptAnswers).where(eq(testAttemptAnswers.attemptId, attemptId)),
    ]);
    if (!testData) throw new AppError(500, 'Test data not found');

    const qIds = answers.map((a) => a.questionId);
    const qPointRows = qIds.length
      ? await db
          .select({ id: questions.id, points: questions.points })
          .from(questions)
          .where(inArray(questions.id, qIds))
      : [];

    const pointsMap = new Map(qPointRows.map((q) => [q.id, q.points]));
    const score = answers.reduce(
      (sum, a) => sum + (a.isCorrect ? (pointsMap.get(a.questionId) ?? 10) : 0),
      0,
    );

    const totalPoints = testData.totalPoints ?? 0;
    const isPerfect = totalPoints > 0 && score >= totalPoints;
    const xpEarned = BASE_XP + (isPerfect ? PERFECT_BONUS_XP : 0);
    const isPassed = testData.passingScore != null ? score >= testData.passingScore : true;

    await db
      .update(testAttempts)
      .set({ status: 'completed', score, totalPoints, xpEarned, completedAt: new Date() })
      .where(eq(testAttempts.id, attemptId));

    await awardXp(userId, xpEarned, 'test_completion', String(attemptId));

    res.json({
      data: {
        attemptId,
        score,
        totalPoints,
        xpEarned,
        isPassed,
        isPerfect,
        correctAnswers: answers.filter((a) => a.isCorrect).length,
        totalAnswers: answers.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getAttemptResult(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const attemptId = parseInt(req.params.attemptId as string, 10);
    if (isNaN(attemptId)) throw new AppError(400, 'Invalid attempt ID');
    const userId = (req as AuthRequest).userId;

    const attempt = await db.query.testAttempts.findFirst({
      where: and(eq(testAttempts.id, attemptId), eq(testAttempts.studentId, userId)),
    });
    if (!attempt) throw new AppError(404, 'Attempt not found');
    if (attempt.status === 'in_progress') throw new AppError(400, 'Test not yet completed');

    const answerRows = await db
      .select({
        a: testAttemptAnswers,
        opt: {
          id: questionOptions.id,
          optionKey: questionOptions.optionKey,
          textEn: questionOptions.textEn,
          textBn: questionOptions.textBn,
          isCorrect: questionOptions.isCorrect,
        },
        tr: {
          text: questionTranslations.text,
          explanation: questionTranslations.explanation,
        },
      })
      .from(testAttemptAnswers)
      .leftJoin(questionOptions, eq(testAttemptAnswers.selectedOptionId, questionOptions.id))
      .leftJoin(
        questionTranslations,
        and(
          eq(questionTranslations.questionId, testAttemptAnswers.questionId),
          eq(questionTranslations.language, 'en'),
        ),
      )
      .where(eq(testAttemptAnswers.attemptId, attemptId));

    res.json({
      data: {
        attempt,
        answers: answerRows.map(({ a, opt, tr }) => ({
          questionId: a.questionId,
          questionText: tr?.text ?? null,
          explanation: tr?.explanation ?? null,
          selectedOption: opt
            ? { id: opt.id, key: opt.optionKey, textEn: opt.textEn, textBn: opt.textBn }
            : null,
          isCorrect: a.isCorrect,
          timeTakenSeconds: a.timeTakenSeconds,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getMyAttempts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as AuthRequest).userId;
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10) || 20, 50);

    const rows = await db
      .select({
        attempt: testAttempts,
        testTitle: tests.title,
        testType: tests.type,
      })
      .from(testAttempts)
      .innerJoin(tests, eq(testAttempts.testId, tests.id))
      .where(eq(testAttempts.studentId, userId))
      .orderBy(desc(testAttempts.startedAt))
      .limit(limit);

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}
