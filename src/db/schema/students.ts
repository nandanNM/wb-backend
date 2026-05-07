import { pgTable, serial, text, integer, boolean, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { classes, subjects } from './academic';

export const studentProfiles = pgTable('student_profiles', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  phone: text('phone').unique(),
  classId: integer('class_id').references(() => classes.id, { onDelete: 'set null' }),
  referralCode: text('referral_code').notNull().unique(),
  referredBy: text('referred_by').references(() => user.id, { onDelete: 'set null' }),
  onboardingCompleted: boolean('onboarding_completed').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const studentSubjects = pgTable(
  'student_subjects',
  {
    id: serial('id').primaryKey(),
    studentId: text('student_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    subjectId: integer('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    enrolledAt: timestamp('enrolled_at').defaultNow().notNull(),
  },
  (t) => [
    unique('uq_student_subject').on(t.studentId, t.subjectId),
    index('student_subjects_student_idx').on(t.studentId),
  ],
);
