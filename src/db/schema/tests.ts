import {
  pgTable, pgEnum, serial, text, integer, boolean,
  timestamp, index, unique,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { subjects, chapters } from './academic';
import { questions, questionOptions } from './questions';

export const testTypeEnum = pgEnum('test_type', ['chapter_test', 'subject_test']);
export const attemptStatusEnum = pgEnum('attempt_status', ['in_progress', 'completed', 'abandoned']);

export const tests = pgTable(
  'tests',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    titleBn: text('title_bn'),
    type: testTypeEnum('type').notNull(),
    subjectId: integer('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
    chapterId: integer('chapter_id').references(() => chapters.id, { onDelete: 'set null' }),
    durationMinutes: integer('duration_minutes').default(30).notNull(),
    totalPoints: integer('total_points').default(0).notNull(),
    passingScore: integer('passing_score'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('tests_subject_idx').on(t.subjectId),
    index('tests_chapter_idx').on(t.chapterId),
  ],
);

export const testQuestions = pgTable(
  'test_questions',
  {
    id: serial('id').primaryKey(),
    testId: integer('test_id')
      .notNull()
      .references(() => tests.id, { onDelete: 'cascade' }),
    questionId: integer('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    order: integer('order').default(0).notNull(),
  },
  (t) => [
    unique('uq_test_question').on(t.testId, t.questionId),
    index('test_questions_test_idx').on(t.testId),
  ],
);

export const testAttempts = pgTable(
  'test_attempts',
  {
    id: serial('id').primaryKey(),
    testId: integer('test_id')
      .notNull()
      .references(() => tests.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: attemptStatusEnum('status').default('in_progress').notNull(),
    score: integer('score'),
    totalPoints: integer('total_points'),
    xpEarned: integer('xp_earned').default(0).notNull(),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (t) => [
    index('attempts_student_idx').on(t.studentId),
    index('attempts_test_idx').on(t.testId),
    index('attempts_student_test_idx').on(t.studentId, t.testId),
  ],
);

export const testAttemptAnswers = pgTable(
  'test_attempt_answers',
  {
    id: serial('id').primaryKey(),
    attemptId: integer('attempt_id')
      .notNull()
      .references(() => testAttempts.id, { onDelete: 'cascade' }),
    questionId: integer('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    selectedOptionId: integer('selected_option_id').references(() => questionOptions.id, {
      onDelete: 'set null',
    }),
    isCorrect: boolean('is_correct'),
    timeTakenSeconds: integer('time_taken_seconds'),
  },
  (t) => [
    unique('uq_attempt_question').on(t.attemptId, t.questionId),
    index('answers_attempt_idx').on(t.attemptId),
  ],
);
