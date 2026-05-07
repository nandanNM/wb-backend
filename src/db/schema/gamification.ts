import {
  pgTable, pgEnum, serial, text, integer, boolean,
  timestamp, date, jsonb, index, unique,
} from 'drizzle-orm/pg-core';
import { user } from './auth';

export const xpReasonEnum = pgEnum('xp_reason', [
  'test_completion',
  'perfect_score',
  'streak_bonus',
  'achievement_unlock',
  'challenge_completion',
  'referral_bonus',
  'daily_login',
]);

export const piCoinTypeEnum = pgEnum('pi_coin_type', [
  'earned',
  'spent',
  'referral_bonus',
  'achievement_reward',
  'challenge_reward',
]);

export const challengeTypeEnum = pgEnum('challenge_type', ['daily', 'weekly', 'special']);
export const challengeStatusEnum = pgEnum('challenge_status', [
  'in_progress',
  'completed',
  'failed',
  'expired',
]);
export const referralStatusEnum = pgEnum('referral_status', ['pending', 'completed']);

// ─── XP ──────────────────────────────────────────────────────────────────────

export const userXp = pgTable('user_xp', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  totalXp: integer('total_xp').default(0).notNull(),
  weeklyXp: integer('weekly_xp').default(0).notNull(),
  monthlyXp: integer('monthly_xp').default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const xpTransactions = pgTable(
  'xp_transactions',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    reason: xpReasonEnum('reason').notNull(),
    referenceId: text('reference_id'),  // FK to attempt/achievement/etc. stored as text for flexibility
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('xp_tx_user_idx').on(t.userId),
    index('xp_tx_created_idx').on(t.createdAt),
  ],
);

// ─── Streaks & Activity ───────────────────────────────────────────────────────

export const userStreaks = pgTable('user_streaks', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  currentStreak: integer('current_streak').default(0).notNull(),
  longestStreak: integer('longest_streak').default(0).notNull(),
  lastActivityDate: date('last_activity_date'),  // used to detect streak breaks
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// One row per user per day — powers the GitHub-style activity chart
export const dailyActivity = pgTable(
  'daily_activity',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    activityCount: integer('activity_count').default(0).notNull(),
    xpEarned: integer('xp_earned').default(0).notNull(),
    testsCompleted: integer('tests_completed').default(0).notNull(),
  },
  (t) => [
    unique('uq_user_date').on(t.userId, t.date),
    index('daily_activity_user_idx').on(t.userId),
    index('daily_activity_date_idx').on(t.date),
  ],
);

// ─── Leagues (Bronze → Silver → Gold → Platinum → Diamond) ───────────────────

export const leagues = pgTable('leagues', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  tier: integer('tier').notNull().unique(),   // 1=lowest, 5=highest
  minXp: integer('min_xp').default(0).notNull(),
  iconUrl: text('icon_url'),
  color: text('color'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userLeague = pgTable('user_league', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  leagueId: integer('league_id').notNull().references(() => leagues.id),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Achievements ─────────────────────────────────────────────────────────────

export const achievements = pgTable('achievements', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),   // 'streak_7', 'first_perfect_score', etc.
  name: text('name').notNull(),
  nameBn: text('name_bn'),
  description: text('description').notNull(),
  descriptionBn: text('description_bn'),
  iconUrl: text('icon_url'),
  xpReward: integer('xp_reward').default(0).notNull(),
  piCoinReward: integer('pi_coin_reward').default(0).notNull(),
  // flexible criteria: { type: 'streak', threshold: 7 } or { type: 'tests_completed', threshold: 10 }
  criteria: jsonb('criteria').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userAchievements = pgTable(
  'user_achievements',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    achievementId: integer('achievement_id')
      .notNull()
      .references(() => achievements.id, { onDelete: 'cascade' }),
    earnedAt: timestamp('earned_at').defaultNow().notNull(),
  },
  (t) => [
    unique('uq_user_achievement').on(t.userId, t.achievementId),
    index('user_achievements_user_idx').on(t.userId),
  ],
);

// ─── Pi Coins ─────────────────────────────────────────────────────────────────

export const userPiCoins = pgTable('user_pi_coins', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  balance: integer('balance').default(0).notNull(),
  totalEarned: integer('total_earned').default(0).notNull(),
  totalSpent: integer('total_spent').default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const piCoinTransactions = pgTable(
  'pi_coin_transactions',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),   // positive = earned, negative = spent
    type: piCoinTypeEnum('type').notNull(),
    description: text('description'),
    referenceId: text('reference_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('pi_coin_tx_user_idx').on(t.userId)],
);

// ─── Referrals ────────────────────────────────────────────────────────────────

export const referrals = pgTable(
  'referrals',
  {
    id: serial('id').primaryKey(),
    referrerId: text('referrer_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    referredUserId: text('referred_user_id')
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: 'cascade' }),
    piCoinsEarned: integer('pi_coins_earned').default(0).notNull(),
    status: referralStatusEnum('status').default('pending').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (t) => [index('referrals_referrer_idx').on(t.referrerId)],
);

// ─── Challenges ───────────────────────────────────────────────────────────────

export const challenges = pgTable('challenges', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  titleBn: text('title_bn'),
  description: text('description'),
  type: challengeTypeEnum('type').notNull(),
  xpReward: integer('xp_reward').default(0).notNull(),
  piCoinReward: integer('pi_coin_reward').default(0).notNull(),
  criteria: jsonb('criteria').notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userChallenges = pgTable(
  'user_challenges',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    challengeId: integer('challenge_id')
      .notNull()
      .references(() => challenges.id, { onDelete: 'cascade' }),
    status: challengeStatusEnum('status').default('in_progress').notNull(),
    progress: jsonb('progress'),   // { testsCompleted: 2, target: 5 }
    startedAt: timestamp('started_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (t) => [
    unique('uq_user_challenge').on(t.userId, t.challengeId),
    index('user_challenges_user_idx').on(t.userId),
  ],
);

// ─── Rank Snapshots ───────────────────────────────────────────────────────────
// Computed periodically via a background job (ORDER BY total_xp DESC)

export const userRanks = pgTable('user_ranks', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  globalRank: integer('global_rank'),
  classRank: integer('class_rank'),
  weeklyRank: integer('weekly_rank'),
  lastCalculatedAt: timestamp('last_calculated_at').defaultNow().notNull(),
});
