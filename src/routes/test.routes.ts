import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import * as test from '../controllers/test.controller';

const router: Router = Router();

router.use(requireAuth);

// Fixed-path routes must come before /:testId to avoid shadowing
router.get('/mixed', test.getMixedTests);
router.get('/my-attempts', test.getMyAttempts);
router.get('/chapters/:chapterId', test.getChapterTests);
router.get('/subjects/:subjectId', test.getSubjectTests);
router.get('/attempts/:attemptId/result', test.getAttemptResult);
router.get('/:testId', test.getTestDetail);

router.post('/:testId/start', test.startTest);
router.post('/attempts/:attemptId/answer', test.submitAnswer);
router.post('/attempts/:attemptId/complete', test.completeTest);

export default router;
