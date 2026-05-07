import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { languageEnum, themeEnum } from './enums';

export const userPreferences = pgTable('user_preferences', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  language: languageEnum('language').default('en').notNull(),
  notificationsEnabled: boolean('notifications_enabled').default(true).notNull(),
  emailNotificationsEnabled: boolean('email_notifications_enabled').default(true).notNull(),
  theme: themeEnum('theme').default('system').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
