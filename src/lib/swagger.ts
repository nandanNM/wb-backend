import swaggerJsdoc from 'swagger-jsdoc';
import { config } from '../config';

const definition: swaggerJsdoc.OAS3Definition = {
  openapi: '3.0.3',

  info: {
    title: 'WB App API',
    version: '1.0.0',
    description: `
## WB App — Backend API Reference

Production-ready REST API powering the WB gamified learning platform.

### Authentication
All endpoints require a **Bearer token** obtained via Better Auth.

\`\`\`
Authorization: Bearer <token>
\`\`\`

Obtain a token:
- **Email/Password** — \`POST /api/auth/sign-in/email\`
- **Google OAuth** — \`GET /api/auth/sign-in/social?provider=google\`

### Role-based access
| Role | Access |
|------|--------|
| \`student\` | Student-facing routes (\`/tests\`, \`/notes\`, \`/users\`, \`/referrals\`) |
| \`admin\`   | All routes including \`/admin/*\` |

### Rate limiting
100 requests per 15-minute window per IP.

### Pagination
All list endpoints return:
\`\`\`json
{
  "data": [...],
  "meta": { "total": 100, "page": 1, "limit": 20, "totalPages": 5 }
}
\`\`\`
    `,
    contact: { name: 'WB App Dev Team' },
    license: { name: 'UNLICENSED' },
  },

  servers: [
    { url: 'http://localhost:3000/api/v1', description: 'Local development' },
    { url: config.appUrl + '/api/v1', description: 'Configured server' },
  ],

  security: [{ bearerAuth: [] }],

  tags: [
    { name: 'Health',              description: 'Health check and Prometheus metrics' },
    { name: 'Auth',                description: 'Better Auth endpoints (handled by Better Auth internally)' },
    { name: 'Tests',               description: 'Student-facing test flow' },
    { name: 'Notes',               description: 'Student-facing notes' },
    { name: 'Users',               description: 'User profile, stats, preferences' },
    { name: 'Referrals',           description: 'Referral codes and Pi Coin rewards' },
    { name: 'Admin - Questions',   description: '🔒 Admin — question bank management + CSV import' },
    { name: 'Admin - Tests',       description: '🔒 Admin — test management and analytics' },
    { name: 'Admin - Notes',       description: '🔒 Admin — note publishing and PDF upload' },
    { name: 'Admin - Academic',    description: '🔒 Admin — classes, subjects, chapters, boards, languages' },
  ],

  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste the token returned by `/api/auth/sign-in/email` → `token`',
      },
    },

    // ── Reusable responses ────────────────────────────────────────────────────
    responses: {
      Unauthorized: {
        description: 'Missing or invalid Bearer token',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Forbidden: {
        description: 'Authenticated but lacks admin role',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      NotFound: {
        description: 'Resource not found',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      BadRequest: {
        description: 'Validation failed',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      NoContent: { description: 'Success — no body returned' },
    },

    // ── Reusable schemas ──────────────────────────────────────────────────────
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: { type: 'string', example: 'Resource not found' },
        },
      },

      PaginationMeta: {
        type: 'object',
        properties: {
          total:      { type: 'integer', example: 100 },
          page:       { type: 'integer', example: 1 },
          limit:      { type: 'integer', example: 20 },
          totalPages: { type: 'integer', example: 5 },
        },
      },

      // ── Academic ────────────────────────────────────────────────────────────
      Class: {
        type: 'object',
        properties: {
          id:        { type: 'integer', example: 1 },
          name:      { type: 'string',  example: 'Class 10' },
          order:     { type: 'integer', example: 10 },
          createdAt: { type: 'string',  format: 'date-time' },
        },
      },

      Subject: {
        type: 'object',
        properties: {
          id:          { type: 'integer', example: 3 },
          classId:     { type: 'integer', example: 1 },
          name:        { type: 'string',  example: 'Mathematics' },
          nameBn:      { type: 'string',  example: 'গণিত', nullable: true },
          description: { type: 'string',  nullable: true },
          iconUrl:     { type: 'string',  nullable: true },
          createdAt:   { type: 'string',  format: 'date-time' },
        },
      },

      Chapter: {
        type: 'object',
        properties: {
          id:        { type: 'integer', example: 7 },
          subjectId: { type: 'integer', example: 3 },
          name:      { type: 'string',  example: 'Algebra' },
          nameBn:    { type: 'string',  example: 'বীজগণিত', nullable: true },
          order:     { type: 'integer', example: 1 },
          createdAt: { type: 'string',  format: 'date-time' },
        },
      },

      ExamBoard: {
        type: 'object',
        properties: {
          value:       { type: 'string', enum: ['wbbse', 'wbchse', 'cbse', 'icse', 'others'] },
          label:       { type: 'string', example: 'WBBSE' },
          description: { type: 'string', example: 'West Bengal Board of Secondary Education (Class 9–10)' },
        },
      },

      Language: {
        type: 'object',
        properties: {
          value: { type: 'string', enum: ['en', 'bn'] },
          label: { type: 'string', example: 'English' },
        },
      },

      // ── Questions ──────────────────────────────────────────────────────────
      QuestionTranslation: {
        type: 'object',
        properties: {
          id:          { type: 'integer' },
          questionId:  { type: 'integer' },
          language:    { type: 'string', enum: ['en', 'bn'] },
          text:        { type: 'string', example: 'What is the value of π?' },
          explanation: { type: 'string', nullable: true },
        },
      },

      QuestionOption: {
        type: 'object',
        properties: {
          id:        { type: 'integer' },
          optionKey: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
          textEn:    { type: 'string', example: '3.14159' },
          textBn:    { type: 'string', nullable: true },
          isCorrect: { type: 'boolean', description: 'Only visible in admin endpoints' },
          imageUrl:  { type: 'string', nullable: true },
          order:     { type: 'integer' },
        },
      },

      Question: {
        type: 'object',
        properties: {
          id:         { type: 'integer', example: 42 },
          chapterId:  { type: 'integer', example: 7 },
          type:       { type: 'string', enum: ['mcq'] },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
          points:     { type: 'integer', example: 10 },
          status:     { type: 'string', enum: ['draft', 'published', 'archived'] },
          category:   { type: 'string', nullable: true, example: 'algebra' },
          tags:       { type: 'array', items: { type: 'string' }, example: ['linear', 'equations'] },
          imageUrl:   { type: 'string', nullable: true },
          isActive:   { type: 'boolean' },
          createdAt:  { type: 'string', format: 'date-time' },
          updatedAt:  { type: 'string', format: 'date-time' },
        },
      },

      QuestionDetail: {
        allOf: [
          { $ref: '#/components/schemas/Question' },
          {
            type: 'object',
            properties: {
              translations: { type: 'array', items: { $ref: '#/components/schemas/QuestionTranslation' } },
              options:      { type: 'array', items: { $ref: '#/components/schemas/QuestionOption' } },
            },
          },
        ],
      },

      CreateQuestionBody: {
        type: 'object',
        required: ['chapterId', 'translations', 'options'],
        properties: {
          chapterId:    { type: 'integer', example: 7 },
          difficulty:   { type: 'string', enum: ['easy', 'medium', 'hard'], default: 'medium' },
          points:       { type: 'integer', default: 10 },
          status:       { type: 'string', enum: ['draft', 'published', 'archived'], default: 'draft' },
          category:     { type: 'string', nullable: true },
          tags:         { type: 'array', items: { type: 'string' } },
          imageUrl:     { type: 'string', nullable: true },
          translations: {
            type: 'array', minItems: 1,
            items: { $ref: '#/components/schemas/QuestionTranslation' },
          },
          options: {
            type: 'array', minItems: 4, maxItems: 4,
            items: { $ref: '#/components/schemas/QuestionOption' },
            description: 'Exactly 4 options; exactly one must have isCorrect: true',
          },
        },
      },

      BulkImportRowError: {
        type: 'object',
        properties: {
          row:    { type: 'integer', example: 3 },
          raw:    { type: 'string' },
          reason: { type: 'string', example: 'chapterId 99 does not exist' },
        },
      },

      BulkImportResult: {
        type: 'object',
        properties: {
          total:    { type: 'integer' },
          inserted: { type: 'integer' },
          skipped:  { type: 'integer' },
          errors:   { type: 'array', items: { $ref: '#/components/schemas/BulkImportRowError' } },
        },
      },

      // ── Tests ──────────────────────────────────────────────────────────────
      Test: {
        type: 'object',
        properties: {
          id:              { type: 'integer', example: 5 },
          title:           { type: 'string',  example: 'Chapter 1 — Algebra Basics' },
          titleBn:         { type: 'string',  nullable: true },
          type:            { type: 'string',  enum: ['chapter_test', 'subject_test'] },
          subjectId:       { type: 'integer', nullable: true },
          chapterId:       { type: 'integer', nullable: true },
          durationMinutes: { type: 'integer', example: 30 },
          totalPoints:     { type: 'integer', example: 100 },
          passingScore:    { type: 'integer', nullable: true, example: 60 },
          isActive:        { type: 'boolean' },
          createdAt:       { type: 'string',  format: 'date-time' },
        },
      },

      TestWithQuestions: {
        allOf: [
          { $ref: '#/components/schemas/Test' },
          {
            type: 'object',
            properties: {
              questions: {
                type: 'array',
                items: {
                  allOf: [
                    { $ref: '#/components/schemas/QuestionDetail' },
                    { type: 'object', properties: { order: { type: 'integer' } } },
                  ],
                },
              },
            },
          },
        ],
      },

      TestAttempt: {
        type: 'object',
        properties: {
          id:          { type: 'integer' },
          testId:      { type: 'integer' },
          studentId:   { type: 'string' },
          status:      { type: 'string', enum: ['in_progress', 'completed', 'abandoned'] },
          score:       { type: 'integer', nullable: true },
          totalPoints: { type: 'integer', nullable: true },
          xpEarned:    { type: 'integer' },
          startedAt:   { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },

      TestStats: {
        type: 'object',
        properties: {
          testId:      { type: 'integer' },
          title:       { type: 'string' },
          totalPoints: { type: 'integer' },
          passingScore:{ type: 'integer', nullable: true },
          questionCount: { type: 'integer' },
          attempts: {
            type: 'object',
            properties: {
              total:          { type: 'integer' },
              completed:      { type: 'integer' },
              abandoned:      { type: 'integer' },
              inProgress:     { type: 'integer' },
              completionRate: { type: 'integer', description: 'Percentage 0–100' },
              passRate:       { type: 'integer', nullable: true },
            },
          },
          scores: {
            type: 'object',
            properties: {
              average:   { type: 'number', nullable: true },
              highest:   { type: 'number', nullable: true },
              lowest:    { type: 'number', nullable: true },
              averageXp: { type: 'number', nullable: true },
            },
          },
        },
      },

      // ── Notes ──────────────────────────────────────────────────────────────
      Note: {
        type: 'object',
        properties: {
          id:            { type: 'integer', example: 9 },
          title:         { type: 'string',  example: 'Algebra — Chapter Notes' },
          titleBn:       { type: 'string',  nullable: true },
          subjectId:     { type: 'integer', nullable: true },
          chapterId:     { type: 'integer', nullable: true },
          pdfUrl:        { type: 'string',  example: 'https://cdn.example.com/notes/algebra.pdf' },
          fileSizeBytes: { type: 'integer', nullable: true },
          pageCount:     { type: 'integer', nullable: true },
          description:   { type: 'string',  nullable: true },
          isPublished:   { type: 'boolean' },
          uploadedBy:    { type: 'string' },
          createdAt:     { type: 'string',  format: 'date-time' },
          updatedAt:     { type: 'string',  format: 'date-time' },
        },
      },

      UploadResult: {
        type: 'object',
        properties: {
          url:       { type: 'string', example: 'https://cdn.example.com/uploads/1234567890-notes.pdf' },
          key:       { type: 'string', example: 'uploads/1234567890-notes.pdf' },
          sizeBytes: { type: 'integer' },
          mimeType:  { type: 'string', example: 'application/pdf' },
        },
      },

      // ── Users ──────────────────────────────────────────────────────────────
      UserProfile: {
        type: 'object',
        properties: {
          id:    { type: 'string' },
          name:  { type: 'string' },
          email: { type: 'string', format: 'email' },
          role:  { type: 'string', enum: ['student', 'admin'] },
          image: { type: 'string', nullable: true },
          profile: {
            type: 'object',
            nullable: true,
            properties: {
              phone:                { type: 'string', nullable: true },
              classId:              { type: 'integer', nullable: true },
              examBoard:            { type: 'string', enum: ['wbbse', 'wbchse', 'cbse', 'icse', 'others'], nullable: true },
              referralCode:         { type: 'string' },
              onboardingCompleted:  { type: 'boolean' },
            },
          },
          xp: {
            type: 'object',
            nullable: true,
            properties: {
              totalXp:   { type: 'integer' },
              weeklyXp:  { type: 'integer' },
              monthlyXp: { type: 'integer' },
            },
          },
          coins: {
            type: 'object',
            nullable: true,
            properties: { balance: { type: 'integer' } },
          },
          streak: {
            type: 'object',
            nullable: true,
            properties: {
              currentStreak: { type: 'integer' },
              longestStreak: { type: 'integer' },
            },
          },
        },
      },

      // ── Referrals ──────────────────────────────────────────────────────────
      ReferralCodeInfo: {
        type: 'object',
        properties: {
          referralCode:       { type: 'string', example: 'WB-AB12CD' },
          totalReferrals:     { type: 'integer' },
          completedReferrals: { type: 'integer' },
          piCoinsEarned:      { type: 'integer' },
        },
      },
    },
  },

  // paths populated by swagger-jsdoc scanning route/controller files
  paths: {},
};

export const swaggerSpec = swaggerJsdoc({
  definition,
  // Scans TypeScript source for @openapi JSDoc blocks.
  // Works in both dev (tsx) and prod (compiled, TS source still present).
  apis: [
    './src/routes/*.ts',
    './src/routes/**/*.ts',
  ],
});
