/**
 * @openapi
 * /notes:
 *   get:
 *     summary: List published notes (optionally filtered by subject or chapter)
 *     tags: [Notes]
 *     parameters:
 *       - in: query
 *         name: subjectId
 *         schema: { type: integer }
 *       - in: query
 *         name: chapterId
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Notes with user read-progress
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Note'
 *                       - type: object
 *                         properties:
 *                           isRead:      { type: boolean }
 *                           lastViewedAt: { type: string, format: date-time, nullable: true }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *
 * /notes/{noteId}:
 *   get:
 *     summary: Get note detail with user progress
 *     tags: [Notes]
 *     parameters:
 *       - in: path
 *         name: noteId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Note detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Note'
 *                     - type: object
 *                       properties:
 *                         isRead:      { type: boolean }
 *                         lastViewedAt: { type: string, format: date-time, nullable: true }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *
 * /notes/{noteId}/view:
 *   post:
 *     summary: Mark a note as viewed / read
 *     tags: [Notes]
 *     parameters:
 *       - in: path
 *         name: noteId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Progress updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     noteId: { type: integer }
 *                     isRead: { type: boolean }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import * as note from '../controllers/note.controller';

const router: Router = Router();

router.use(requireAuth);

router.get('/', note.listNotes);
router.get('/:noteId', note.getNoteDetail);
router.post('/:noteId/view', note.markNoteViewed);

export default router;
