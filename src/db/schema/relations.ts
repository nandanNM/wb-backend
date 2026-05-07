import { relations } from 'drizzle-orm';
import { user, session, account } from './auth';
import { classes, subjects, chapters } from './academic';
import { studentProfiles, studentSubjects } from './students';
import { questions, questionTranslations, questionOptions } from './questions';
import { tests, testQuestions, testAttempts, testAttemptAnswers } from './tests';
import {
  userXp, xpTransactions, userStreaks, dailyActivity,
  leagues, userLeague, achievements, userAchievements,
  userPiCoins, piCoinTransactions, referrals, challenges, userChallenges, userRanks,
} from './gamification';
import { notes, userNoteProgress } from './content';
import { userPreferences } from './preferences';
import { pushTokens, notifications } from './notifications';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const userRelations = relations(user, ({ one, many }) => ({
  sessions: many(session),
  accounts: many(account),
  studentProfile: one(studentProfiles, { fields: [user.id], references: [studentProfiles.userId] }),
  studentSubjects: many(studentSubjects),
  testAttempts: many(testAttempts),
  xp: one(userXp, { fields: [user.id], references: [userXp.userId] }),
  xpTransactions: many(xpTransactions),
  streak: one(userStreaks, { fields: [user.id], references: [userStreaks.userId] }),
  dailyActivities: many(dailyActivity),
  league: one(userLeague, { fields: [user.id], references: [userLeague.userId] }),
  achievements: many(userAchievements),
  piCoins: one(userPiCoins, { fields: [user.id], references: [userPiCoins.userId] }),
  piCoinTransactions: many(piCoinTransactions),
  referralsMade: many(referrals, { relationName: 'referrer' }),
  referralReceived: one(referrals, {
    fields: [user.id],
    references: [referrals.referredUserId],
    relationName: 'referred',
  }),
  challenges: many(userChallenges),
  rank: one(userRanks, { fields: [user.id], references: [userRanks.userId] }),
  noteProgress: many(userNoteProgress),
  uploadedNotes: many(notes),
  preferences: one(userPreferences, { fields: [user.id], references: [userPreferences.userId] }),
  pushTokens: many(pushTokens),
  notifications: many(notifications),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

// ─── Academic ─────────────────────────────────────────────────────────────────

export const classesRelations = relations(classes, ({ many }) => ({
  subjects: many(subjects),
  students: many(studentProfiles),
}));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  class: one(classes, { fields: [subjects.classId], references: [classes.id] }),
  chapters: many(chapters),
  tests: many(tests),
  notes: many(notes),
  enrolledStudents: many(studentSubjects),
}));

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  subject: one(subjects, { fields: [chapters.subjectId], references: [subjects.id] }),
  questions: many(questions),
  tests: many(tests),
  notes: many(notes),
}));

// ─── Students ─────────────────────────────────────────────────────────────────

export const studentProfilesRelations = relations(studentProfiles, ({ one }) => ({
  user: one(user, { fields: [studentProfiles.userId], references: [user.id] }),
  class: one(classes, { fields: [studentProfiles.classId], references: [classes.id] }),
  referrer: one(user, {
    fields: [studentProfiles.referredBy],
    references: [user.id],
    relationName: 'referrer',
  }),
}));

export const studentSubjectsRelations = relations(studentSubjects, ({ one }) => ({
  student: one(user, { fields: [studentSubjects.studentId], references: [user.id] }),
  subject: one(subjects, { fields: [studentSubjects.subjectId], references: [subjects.id] }),
}));

// ─── Questions ────────────────────────────────────────────────────────────────

export const questionsRelations = relations(questions, ({ one, many }) => ({
  chapter: one(chapters, { fields: [questions.chapterId], references: [chapters.id] }),
  translations: many(questionTranslations),
  options: many(questionOptions),
  testQuestions: many(testQuestions),
  attemptAnswers: many(testAttemptAnswers),
}));

export const questionTranslationsRelations = relations(questionTranslations, ({ one }) => ({
  question: one(questions, { fields: [questionTranslations.questionId], references: [questions.id] }),
}));

export const questionOptionsRelations = relations(questionOptions, ({ one }) => ({
  question: one(questions, { fields: [questionOptions.questionId], references: [questions.id] }),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

export const testsRelations = relations(tests, ({ one, many }) => ({
  subject: one(subjects, { fields: [tests.subjectId], references: [subjects.id] }),
  chapter: one(chapters, { fields: [tests.chapterId], references: [chapters.id] }),
  testQuestions: many(testQuestions),
  attempts: many(testAttempts),
}));

export const testQuestionsRelations = relations(testQuestions, ({ one }) => ({
  test: one(tests, { fields: [testQuestions.testId], references: [tests.id] }),
  question: one(questions, { fields: [testQuestions.questionId], references: [questions.id] }),
}));

export const testAttemptsRelations = relations(testAttempts, ({ one, many }) => ({
  test: one(tests, { fields: [testAttempts.testId], references: [tests.id] }),
  student: one(user, { fields: [testAttempts.studentId], references: [user.id] }),
  answers: many(testAttemptAnswers),
}));

export const testAttemptAnswersRelations = relations(testAttemptAnswers, ({ one }) => ({
  attempt: one(testAttempts, { fields: [testAttemptAnswers.attemptId], references: [testAttempts.id] }),
  question: one(questions, { fields: [testAttemptAnswers.questionId], references: [questions.id] }),
  selectedOption: one(questionOptions, {
    fields: [testAttemptAnswers.selectedOptionId],
    references: [questionOptions.id],
  }),
}));

// ─── Gamification ─────────────────────────────────────────────────────────────

export const userXpRelations = relations(userXp, ({ one }) => ({
  user: one(user, { fields: [userXp.userId], references: [user.id] }),
}));

export const xpTransactionsRelations = relations(xpTransactions, ({ one }) => ({
  user: one(user, { fields: [xpTransactions.userId], references: [user.id] }),
}));

export const userStreaksRelations = relations(userStreaks, ({ one }) => ({
  user: one(user, { fields: [userStreaks.userId], references: [user.id] }),
}));

export const dailyActivityRelations = relations(dailyActivity, ({ one }) => ({
  user: one(user, { fields: [dailyActivity.userId], references: [user.id] }),
}));

export const leaguesRelations = relations(leagues, ({ many }) => ({
  members: many(userLeague),
}));

export const userLeagueRelations = relations(userLeague, ({ one }) => ({
  user: one(user, { fields: [userLeague.userId], references: [user.id] }),
  league: one(leagues, { fields: [userLeague.leagueId], references: [leagues.id] }),
}));

export const achievementsRelations = relations(achievements, ({ many }) => ({
  earnedBy: many(userAchievements),
}));

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(user, { fields: [userAchievements.userId], references: [user.id] }),
  achievement: one(achievements, {
    fields: [userAchievements.achievementId],
    references: [achievements.id],
  }),
}));

export const userPiCoinsRelations = relations(userPiCoins, ({ one }) => ({
  user: one(user, { fields: [userPiCoins.userId], references: [user.id] }),
}));

export const piCoinTransactionsRelations = relations(piCoinTransactions, ({ one }) => ({
  user: one(user, { fields: [piCoinTransactions.userId], references: [user.id] }),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(user, {
    fields: [referrals.referrerId],
    references: [user.id],
    relationName: 'referrer',
  }),
  referredUser: one(user, {
    fields: [referrals.referredUserId],
    references: [user.id],
    relationName: 'referred',
  }),
}));

export const challengesRelations = relations(challenges, ({ many }) => ({
  userChallenges: many(userChallenges),
}));

export const userChallengesRelations = relations(userChallenges, ({ one }) => ({
  user: one(user, { fields: [userChallenges.userId], references: [user.id] }),
  challenge: one(challenges, { fields: [userChallenges.challengeId], references: [challenges.id] }),
}));

export const userRanksRelations = relations(userRanks, ({ one }) => ({
  user: one(user, { fields: [userRanks.userId], references: [user.id] }),
}));

// ─── Content ──────────────────────────────────────────────────────────────────

export const notesRelations = relations(notes, ({ one, many }) => ({
  subject: one(subjects, { fields: [notes.subjectId], references: [subjects.id] }),
  chapter: one(chapters, { fields: [notes.chapterId], references: [chapters.id] }),
  uploadedBy: one(user, { fields: [notes.uploadedBy], references: [user.id] }),
  progress: many(userNoteProgress),
}));

export const userNoteProgressRelations = relations(userNoteProgress, ({ one }) => ({
  user: one(user, { fields: [userNoteProgress.userId], references: [user.id] }),
  note: one(notes, { fields: [userNoteProgress.noteId], references: [notes.id] }),
}));

// ─── Preferences & Notifications ─────────────────────────────────────────────

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(user, { fields: [userPreferences.userId], references: [user.id] }),
}));

export const pushTokensRelations = relations(pushTokens, ({ one }) => ({
  user: one(user, { fields: [pushTokens.userId], references: [user.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(user, { fields: [notifications.userId], references: [user.id] }),
}));
