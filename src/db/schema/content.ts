import {
  pgTable, serial, text, integer, boolean,
  timestamp, index, unique,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { subjects, chapters } from './academic';

export const notes = pgTable(
  'notes',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    titleBn: text('title_bn'),
    subjectId: integer('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
    chapterId: integer('chapter_id').references(() => chapters.id, { onDelete: 'set null' }),
    pdfUrl: text('pdf_url').notNull(),
    fileSizeBytes: integer('file_size_bytes'),
    pageCount: integer('page_count'),
    description: text('description'),
    isPublished: boolean('is_published').default(false).notNull(),
    uploadedBy: text('uploaded_by')
      .notNull()
      .references(() => user.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('notes_subject_idx').on(t.subjectId),
    index('notes_chapter_idx').on(t.chapterId),
  ],
);

export const userNoteProgress = pgTable(
  'user_note_progress',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    noteId: integer('note_id').notNull().references(() => notes.id, { onDelete: 'cascade' }),
    isRead: boolean('is_read').default(false).notNull(),
    lastViewedAt: timestamp('last_viewed_at'),
  },
  (t) => [
    unique('uq_user_note').on(t.userId, t.noteId),
    index('note_progress_user_idx').on(t.userId),
  ],
);
