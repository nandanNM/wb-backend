import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['student', 'admin']);
export const languageEnum = pgEnum('language', ['en', 'bn']);
export const difficultyEnum = pgEnum('difficulty', ['easy', 'medium', 'hard']);
export const themeEnum = pgEnum('theme', ['light', 'dark', 'system']);
