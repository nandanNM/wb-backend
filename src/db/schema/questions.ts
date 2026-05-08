import {
  pgTable, pgEnum, serial, text, integer, boolean,
  timestamp, index, unique,
} from 'drizzle-orm/pg-core';
import { chapters } from './academic';
import { languageEnum, difficultyEnum, questionStatusEnum } from './enums';

export const questionTypeEnum = pgEnum('question_type', ['mcq']);

export const questions = pgTable(
  'questions',
  {
    id: serial('id').primaryKey(),
    chapterId: integer('chapter_id')
      .notNull()
      .references(() => chapters.id, { onDelete: 'cascade' }),
    type: questionTypeEnum('type').default('mcq').notNull(),
    difficulty: difficultyEnum('difficulty').default('medium').notNull(),
    points: integer('points').default(10).notNull(),
    status: questionStatusEnum('status').default('draft').notNull(),
    category: text('category'),
    tags: text('tags').array().notNull().default([]),
    imageUrl: text('image_url'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('questions_chapter_idx').on(t.chapterId),
    index('questions_difficulty_idx').on(t.difficulty),
    index('questions_status_idx').on(t.status),
    index('questions_category_idx').on(t.category),
  ],
);

export const questionTranslations = pgTable(
  'question_translations',
  {
    id: serial('id').primaryKey(),
    questionId: integer('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    language: languageEnum('language').notNull(),
    text: text('text').notNull(),
    explanation: text('explanation'),
  },
  (t) => [
    unique('uq_question_language').on(t.questionId, t.language),
    index('q_translations_question_idx').on(t.questionId),
  ],
);

export const questionOptions = pgTable(
  'question_options',
  {
    id: serial('id').primaryKey(),
    questionId: integer('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    optionKey: text('option_key').notNull(), // 'A', 'B', 'C', 'D'
    textEn: text('text_en').notNull(),
    textBn: text('text_bn'),
    isCorrect: boolean('is_correct').default(false).notNull(),
    imageUrl: text('image_url'),
    order: integer('order').notNull(),
  },
  (t) => [index('q_options_question_idx').on(t.questionId)],
);
