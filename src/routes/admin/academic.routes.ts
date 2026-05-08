/**
 * @openapi
 * tags:
 *   - name: Admin - Academic
 *     description: Admin endpoints for managing classes, subjects, chapters, boards, and languages
 */

import { Router } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin';
import {
  listBoardsHandler,
  listLanguagesHandler,
  listClassesHandler,
  createClassHandler,
  updateClassHandler,
  deleteClassHandler,
  listSubjectsHandler,
  createSubjectHandler,
  updateSubjectHandler,
  deleteSubjectHandler,
  listChaptersHandler,
  createChapterHandler,
  updateChapterHandler,
  deleteChapterHandler,
} from '../../controllers/admin/academic.controller';

const adminAcademicRouter: Router = Router();

adminAcademicRouter.use(requireAdmin);

// ── Reference data (boards, languages) ───────────────────────────────────────

/**
 * @openapi
 * /api/v1/admin/academic/boards:
 *   get:
 *     summary: List available exam boards
 *     tags: [Admin - Academic]
 */
adminAcademicRouter.get('/boards', listBoardsHandler);

/**
 * @openapi
 * /api/v1/admin/academic/languages:
 *   get:
 *     summary: List supported content languages
 *     tags: [Admin - Academic]
 */
adminAcademicRouter.get('/languages', listLanguagesHandler);

// ── Classes ───────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/admin/academic/classes:
 *   get:
 *     summary: List all classes ordered by display order
 *     tags: [Admin - Academic]
 */
adminAcademicRouter.get('/classes', listClassesHandler);

/**
 * @openapi
 * /api/v1/admin/academic/classes:
 *   post:
 *     summary: Create a class
 *     tags: [Admin - Academic]
 */
adminAcademicRouter.post('/classes', createClassHandler);

/**
 * @openapi
 * /api/v1/admin/academic/classes/{id}:
 *   put:
 *     summary: Update a class
 *     tags: [Admin - Academic]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 */
adminAcademicRouter.put('/classes/:id', updateClassHandler);

/**
 * @openapi
 * /api/v1/admin/academic/classes/{id}:
 *   delete:
 *     summary: Delete a class (?force=true to cascade)
 *     tags: [Admin - Academic]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *       - { in: query, name: force, schema: { type: boolean } }
 */
adminAcademicRouter.delete('/classes/:id', deleteClassHandler);

// ── Subjects ──────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/admin/academic/subjects:
 *   get:
 *     summary: List subjects (filter with ?classId=)
 *     tags: [Admin - Academic]
 *     parameters:
 *       - { in: query, name: classId, schema: { type: integer } }
 */
adminAcademicRouter.get('/subjects', listSubjectsHandler);

/**
 * @openapi
 * /api/v1/admin/academic/subjects:
 *   post:
 *     summary: Create a subject under a class
 *     tags: [Admin - Academic]
 */
adminAcademicRouter.post('/subjects', createSubjectHandler);

/**
 * @openapi
 * /api/v1/admin/academic/subjects/{id}:
 *   put:
 *     summary: Update a subject
 *     tags: [Admin - Academic]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 */
adminAcademicRouter.put('/subjects/:id', updateSubjectHandler);

/**
 * @openapi
 * /api/v1/admin/academic/subjects/{id}:
 *   delete:
 *     summary: Delete a subject (?force=true to cascade)
 *     tags: [Admin - Academic]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *       - { in: query, name: force, schema: { type: boolean } }
 */
adminAcademicRouter.delete('/subjects/:id', deleteSubjectHandler);

// ── Chapters ──────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/admin/academic/chapters:
 *   get:
 *     summary: List chapters (filter with ?subjectId=)
 *     tags: [Admin - Academic]
 *     parameters:
 *       - { in: query, name: subjectId, schema: { type: integer } }
 */
adminAcademicRouter.get('/chapters', listChaptersHandler);

/**
 * @openapi
 * /api/v1/admin/academic/chapters:
 *   post:
 *     summary: Create a chapter under a subject
 *     tags: [Admin - Academic]
 */
adminAcademicRouter.post('/chapters', createChapterHandler);

/**
 * @openapi
 * /api/v1/admin/academic/chapters/{id}:
 *   put:
 *     summary: Update a chapter
 *     tags: [Admin - Academic]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 */
adminAcademicRouter.put('/chapters/:id', updateChapterHandler);

/**
 * @openapi
 * /api/v1/admin/academic/chapters/{id}:
 *   delete:
 *     summary: Delete a chapter (?force=true to cascade questions)
 *     tags: [Admin - Academic]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *       - { in: query, name: force, schema: { type: boolean } }
 */
adminAcademicRouter.delete('/chapters/:id', deleteChapterHandler);

export default adminAcademicRouter;
