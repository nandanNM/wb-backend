import {
  pgTable, pgEnum, serial, text, boolean,
  timestamp, jsonb, index,
} from 'drizzle-orm/pg-core';
import { user } from './auth';

export const platformEnum = pgEnum('platform', ['ios', 'android']);
export const notificationTypeEnum = pgEnum('notification_type', [
  'test_reminder',
  'achievement',
  'challenge',
  'streak_alert',
  'system',
  'referral',
]);

export const pushTokens = pgTable(
  'push_tokens',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),   // Expo push token
    platform: platformEnum('platform').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('push_tokens_user_idx').on(t.userId)],
);

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    // null means broadcast to all users
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    data: jsonb('data'),   // arbitrary payload for deep linking in Expo
    type: notificationTypeEnum('type').notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    sentAt: timestamp('sent_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('notifications_user_idx').on(t.userId),
    index('notifications_type_idx').on(t.type),
  ],
);
