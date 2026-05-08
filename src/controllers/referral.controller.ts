import { Request, Response, NextFunction } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import {
  referrals,
  studentProfiles,
  userPiCoins,
  piCoinTransactions,
  user as userTable,
} from '../db/schema';
import { AppError } from '../middleware/errorHandler';
import { validate } from '../lib/validate';
import type { AuthRequest } from '../middleware/requireAuth';

const REFERRAL_PI_COINS = 100;

// ─── Internal helper ──────────────────────────────────────────────────────────

async function awardPiCoins(
  userId: string,
  amount: number,
  type: 'earned' | 'spent' | 'referral_bonus' | 'achievement_reward' | 'challenge_reward',
  description: string,
  referenceId?: string,
): Promise<void> {
  await Promise.all([
    db.insert(piCoinTransactions).values({ userId, amount, type, description, referenceId }),
    db
      .insert(userPiCoins)
      .values({
        userId,
        balance: amount,
        totalEarned: amount,
        totalSpent: 0,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userPiCoins.userId,
        set: {
          balance: sql`${userPiCoins.balance} + ${amount}`,
          totalEarned: sql`${userPiCoins.totalEarned} + ${amount}`,
          updatedAt: new Date(),
        },
      }),
  ]);
}

// ─── Controllers ──────────────────────────────────────────────────────────────

export async function getMyReferralCode(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as AuthRequest).userId;

    const profile = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.userId, userId),
      columns: { referralCode: true },
    });
    if (!profile) throw new AppError(404, 'Student profile not found');

    const [countRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(referrals)
      .where(eq(referrals.referrerId, userId));

    const [completedRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(referrals)
      .where(and(eq(referrals.referrerId, userId), eq(referrals.status, 'completed')));

    const [coinsRow] = await db
      .select({ total: sql<number>`coalesce(sum(pi_coins_earned), 0)::int` })
      .from(referrals)
      .where(and(eq(referrals.referrerId, userId), eq(referrals.status, 'completed')));

    res.json({
      data: {
        referralCode: profile.referralCode,
        totalReferrals: countRow?.total ?? 0,
        completedReferrals: completedRow?.total ?? 0,
        totalCoinsEarned: coinsRow?.total ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

const applyReferralSchema = z.object({
  code: z.string().trim().min(1, 'Referral code is required'),
});

export async function applyReferralCode(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as AuthRequest).userId;
    const { code } = validate(applyReferralSchema, req.body);

    const myProfile = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.userId, userId),
      columns: { userId: true, referredBy: true },
    });
    if (!myProfile) throw new AppError(404, 'Student profile not found');
    if (myProfile.referredBy) throw new AppError(400, 'You have already used a referral code');

    // Find the referrer by referral code
    const referrerProfile = await db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.referralCode, code),
      columns: { userId: true },
    });
    if (!referrerProfile) throw new AppError(404, 'Invalid referral code');
    if (referrerProfile.userId === userId) throw new AppError(400, 'You cannot use your own referral code');

    // Check for existing referral record (shouldn't happen, but guard against it)
    const existing = await db.query.referrals.findFirst({
      where: eq(referrals.referredUserId, userId),
      columns: { id: true },
    });
    if (existing) throw new AppError(400, 'Referral already recorded');

    // Record the referral and award Pi Coins to the referrer atomically
    await Promise.all([
      db.update(studentProfiles)
        .set({ referredBy: referrerProfile.userId, updatedAt: new Date() })
        .where(eq(studentProfiles.userId, userId)),

      db.insert(referrals).values({
        referrerId: referrerProfile.userId,
        referredUserId: userId,
        piCoinsEarned: REFERRAL_PI_COINS,
        status: 'completed',
        completedAt: new Date(),
      }),

      awardPiCoins(
        referrerProfile.userId,
        REFERRAL_PI_COINS,
        'referral_bonus',
        `Referral reward for inviting user ${userId}`,
        userId,
      ),
    ]);

    res.json({
      data: {
        message: 'Referral code applied successfully',
        coinsAwardedToReferrer: REFERRAL_PI_COINS,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getReferralHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as AuthRequest).userId;

    const rows = await db
      .select({
        id: referrals.id,
        status: referrals.status,
        piCoinsEarned: referrals.piCoinsEarned,
        createdAt: referrals.createdAt,
        completedAt: referrals.completedAt,
        referredUser: {
          id: userTable.id,
          name: userTable.name,
        },
      })
      .from(referrals)
      .innerJoin(userTable, eq(referrals.referredUserId, userTable.id))
      .where(eq(referrals.referrerId, userId));

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
}
