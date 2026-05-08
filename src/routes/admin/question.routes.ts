/**
 * @openapi
 * tags:
 *   - name: Admin - Questions
 *     description: Admin-only question management endpoints
 *
 * components:
 *   schemas:
 *     Option:
 *       type: object
 *       required: [optionKey, textEn, isCorrect, order]
 *       properties:
 *         optionKey:  { type: string, enum: [A, B, C, D] }
 *         textEn:     { type: string }
 *         textBn:     { type: string, nullable: true }
 *         isCorrect:  { type: boolean }
 *         imageUrl:   { type: string, nullable: true }
 *         order:      { type: integer, minimum: 1, maximum: 4 }
 *
 *     Translation:
 *       type: object
 *       required: [language, text]
 *       properties:
 *         language:    { type: string, enum: [en, bn] }
 *         text:        { type: string }
 *         explanation: { type: string, nullable: true }
 *
 *     CreateQuestionBody:
 *       type: object
 *       required: [chapterId, translations, options]
 *       properties:
 *         chapterId:    { type: integer }
 *         difficulty:   { type: string, enum: [easy, medium, hard], default: medium }
 *         points:       { type: integer, default: 10 }
 *         status:       { type: string, enum: [draft, published, archived], default: draft }
 *         category:     { type: string, nullable: true }
 *         tags:         { type: array, items: { type: string } }
 *         imageUrl:     { type: string, nullable: true }
 *         translations: { type: array, items: { $ref: '#/components/schemas/Translation' } }
 *         options:      { type: array, items: { $ref: '#/components/schemas/Option' }, minItems: 4, maxItems: 4 }
 */

import { Router } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin';
import { csvUpload } from '../../lib/upload';
import {
  createQuestionHandler,
  getQuestionHandler,
  listQuestionsHandler,
  updateQuestionHandler,
  deleteQuestionHandler,
  bulkUploadCSVHandler,
} from '../../controllers/admin/question.controller';

const adminQuestionRouter: Router = Router();

// All routes require admin authentication
adminQuestionRouter.use(requireAdmin);

/**
 * @openapi
 * /api/v1/admin/questions:
 *   get:
 *     summary: List questions with pagination, filters, and search
 *     tags: [Admin - Questions]
 *     parameters:
 *       - { in: query, name: page,       schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit,      schema: { type: integer, default: 20, maximum: 100 } }
 *       - { in: query, name: chapterId,  schema: { type: integer } }
 *       - { in: query, name: subjectId,  schema: { type: integer } }
 *       - { in: query, name: difficulty, schema: { type: string, enum: [easy, medium, hard] } }
 *       - { in: query, name: status,     schema: { type: string, enum: [draft, published, archived] } }
 *       - { in: query, name: category,   schema: { type: string } }
 *       - { in: query, name: search,     schema: { type: string }, description: "Full-text search on question text" }
 *       - { in: query, name: tags,       schema: { type: string }, description: "Comma-separated tag list" }
 *       - { in: query, name: sortBy,     schema: { type: string, enum: [createdAt, points], default: createdAt } }
 *       - { in: query, name: sortOrder,  schema: { type: string, enum: [asc, desc], default: desc } }
 */
adminQuestionRouter.get('/', listQuestionsHandler);

/**
 * @openapi
 * /api/v1/admin/questions/bulk-upload:
 *   post:
 *     summary: Bulk import questions from a CSV file
 *     tags: [Admin - Questions]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 */
// Must be declared before /:id to prevent "bulk-upload" being parsed as an ID
adminQuestionRouter.post('/bulk-upload', csvUpload.single('file'), bulkUploadCSVHandler);

/**
 * @openapi
 * /api/v1/admin/questions:
 *   post:
 *     summary: Create a new question
 *     tags: [Admin - Questions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateQuestionBody' }
 */
adminQuestionRouter.post('/', createQuestionHandler);

/**
 * @openapi
 * /api/v1/admin/questions/{id}:
 *   get:
 *     summary: Get question detail (includes isCorrect on options)
 *     tags: [Admin - Questions]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 */
adminQuestionRouter.get('/:id', getQuestionHandler);

/**
 * @openapi
 * /api/v1/admin/questions/{id}:
 *   put:
 *     summary: Update question (partial — only send fields to change)
 *     tags: [Admin - Questions]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 */
adminQuestionRouter.put('/:id', updateQuestionHandler);

/**
 * @openapi
 * /api/v1/admin/questions/{id}:
 *   delete:
 *     summary: Soft-delete question (archived + inactive)
 *     tags: [Admin - Questions]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 */
adminQuestionRouter.delete('/:id', deleteQuestionHandler);

export default adminQuestionRouter;
