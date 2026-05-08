import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import * as note from '../controllers/note.controller';

const router: Router = Router();

router.use(requireAuth);

router.get('/', note.listNotes);
router.get('/:noteId', note.getNoteDetail);
router.post('/:noteId/view', note.markNoteViewed);

export default router;
