/**
 * @openapi
 * tags:
 *   - name: Admin - Notes
 *     description: Admin-only note management endpoints
 */

import { Router } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin';
import { pdfUpload } from '../../lib/upload';
import {
  listNotesHandler,
  createNoteHandler,
  getNoteHandler,
  updateNoteHandler,
  publishNoteHandler,
  unpublishNoteHandler,
  deleteNoteHandler,
  uploadPdfHandler,
} from '../../controllers/admin/note.controller';

const adminNoteRouter: Router = Router();

adminNoteRouter.use(requireAdmin);

// Fixed paths before /:id
adminNoteRouter.post('/upload-pdf', pdfUpload.single('file'), uploadPdfHandler);

adminNoteRouter.get('/', listNotesHandler);
adminNoteRouter.post('/', createNoteHandler);

adminNoteRouter.get('/:id', getNoteHandler);
adminNoteRouter.put('/:id', updateNoteHandler);
adminNoteRouter.delete('/:id', deleteNoteHandler);

adminNoteRouter.patch('/:id/publish', publishNoteHandler);
adminNoteRouter.patch('/:id/unpublish', unpublishNoteHandler);

export default adminNoteRouter;
