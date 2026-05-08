import { Request, Response, NextFunction } from 'express';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import {
  user as userTable,
  studentProfiles,
  studentSubjects,
  userPreferences,
  userXp,
  userPiCoins,
  userStreaks,
  userAchievements,
  userRanks,
} from '../db/schema';
import { AppError } from '../middleware/errorHandler';
import { validate } from '../lib/validate';
import type { AuthRequest } from '../middleware/requireAuth';

// ─── Mock upload ──────────────────────────────────────────────────────────────
// Replace this function with real cloud storage (S3, R2, etc.) upload logic
function mockUploadImage(userId: string): string {
  return `https://storage.example.com/avatars/${userId}-${Date.now()}.jpg`;
}

// ─── Controllers ──────────────────────────────────────────────────────────────

export async function getMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as AuthRequest).userId;

    const [[userRow], profile, xp, coins, streak, rank, subjects] = await Promise.all([
      db
        .select({
          id: userTable.id,
          name: userTable.name,
          email: userTable.email,
          image: userTable.image,
          role: userTable.role,
          createdAt: userTable.createdAt,
        })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1),
      db.query.studentProfiles.findFirst({ where: eq(studentProfiles.userId, userId) }),
      db.query.userXp.findFirst({ where: eq(userXp.userId, userId) }),
      db.query.userPiCoins.findFirst({ where: eq(userPiCoins.userId, userId) }),
      db.query.userStreaks.findFirst({ where: eq(userStreaks.userId, userId) }),
      db.query.userRanks.findFirst({ where: eq(userRanks.userId, userId) }),
      db
        .select({ subjectId: studentSubjects.subjectId })
        .from(studentSubjects)
        .where(eq(studentSubjects.studentId, userId)),
    ]);

    if (!userRow) throw new AppError(404, 'User not found');

    res.json({
      data: {
        ...userRow,
        profile: profile ?? null,
        enrolledSubjectIds: subjects.map((s) => s.subjectId),
        xp: xp ?? { totalXp: 0, weeklyXp: 0, monthlyXp: 0 },
        coins: coins
          ? { balance: coins.balance, totalEarned: coins.totalEarned }
          : { balance: 0, totalEarned: 0 },
        streak: streak ?? { currentStreak: 0, longestStreak: 0 },
        rank: rank ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getMyStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as AuthRequest).userId;

    const [xp, coins, streak, rank, achievementCount] = await Promise.all([
      db.query.userXp.findFirst({ where: eq(userXp.userId, userId) }),
      db.query.userPiCoins.findFirst({ where: eq(userPiCoins.userId, userId) }),
      db.query.userStreaks.findFirst({ where: eq(userStreaks.userId, userId) }),
      db.query.userRanks.findFirst({ where: eq(userRanks.userId, userId) }),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(userAchievements)
        .where(eq(userAchievements.userId, userId))
        .then((r) => r[0]?.count ?? 0),
    ]);

    res.json({
      data: {
        xp: xp ?? { totalXp: 0, weeklyXp: 0, monthlyXp: 0 },
        coins: coins ?? { balance: 0, totalEarned: 0, totalSpent: 0 },
        streak: streak ?? { currentStreak: 0, longestStreak: 0, lastActivityDate: null },
        rank: rank ?? null,
        achievementCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

const updatePreferencesSchema = z.object({
  language: z.enum(['en', 'bn']).optional(),
  notificationsEnabled: z.boolean().optional(),
  emailNotificationsEnabled: z.boolean().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
});

export async function updatePreferences(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as AuthRequest).userId;
    const body = validate(updatePreferencesSchema, req.body);

    if (!Object.keys(body).length) throw new AppError(400, 'No fields provided to update');

    const [updated] = await db
      .insert(userPreferences)
      .values({ userId, ...body, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { ...body, updatedAt: new Date() },
      })
      .returning();

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

const updateSubjectsSchema = z.object({
  subjectIds: z.array(z.number().int().positive()).min(1, 'At least one subject required'),
});

export async function updateSubjects(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as AuthRequest).userId;
    const { subjectIds } = validate(updateSubjectsSchema, req.body);

    // Replace enrollments atomically
    await db.delete(studentSubjects).where(eq(studentSubjects.studentId, userId));

    const rows = subjectIds.map((subjectId) => ({ studentId: userId, subjectId }));
    await db.insert(studentSubjects).values(rows).onConflictDoNothing();

    res.json({ data: { enrolledSubjectIds: subjectIds } });
  } catch (err) {
    next(err);
  }
}

const examBoardValues = ['wbbse', 'wbchse', 'cbse', 'icse', 'others'] as const;

const updateAcademicProfileSchema = z
  .object({
    classId: z.number().int().positive().optional(),
    examBoard: z.enum(examBoardValues).optional(),
  })
  .refine((d) => d.classId !== undefined || d.examBoard !== undefined, {
    message: 'Provide at least one of classId or examBoard',
  });

export async function updateClass(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as AuthRequest).userId;
    const body = validate(updateAcademicProfileSchema, req.body);

    const profile = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.userId, userId),
      columns: { userId: true },
    });
    if (!profile) throw new AppError(404, 'Student profile not found');

    const [updated] = await db
      .update(studentProfiles)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(studentProfiles.userId, userId))
      .returning({
        classId: studentProfiles.classId,
        examBoard: studentProfiles.examBoard,
      });

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

export async function uploadAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as AuthRequest).userId;

    // Mock: generate a placeholder URL.
    // Replace mockUploadImage() with real storage upload (S3/R2) when ready.
    const avatarUrl = mockUploadImage(userId);

    await db
      .update(userTable)
      .set({ image: avatarUrl, updatedAt: new Date() })
      .where(eq(userTable.id, userId));

    res.json({ data: { avatarUrl } });
  } catch (err) {
    next(err);
  }
}
