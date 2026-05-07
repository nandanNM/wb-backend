import { pgTable, serial, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

export const classes = pgTable('classes', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),   // "Class 9", "Class 10", etc.
  order: integer('order').notNull(),        // for sorted display
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const subjects = pgTable(
  'subjects',
  {
    id: serial('id').primaryKey(),
    classId: integer('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    nameBn: text('name_bn'),
    description: text('description'),
    iconUrl: text('icon_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('subjects_class_idx').on(t.classId)],
);

export const chapters = pgTable(
  'chapters',
  {
    id: serial('id').primaryKey(),
    subjectId: integer('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    nameBn: text('name_bn'),
    order: integer('order').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('chapters_subject_idx').on(t.subjectId)],
);
