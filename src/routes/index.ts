import { Router } from 'express';
import testRouter from './test.routes';
import noteRouter from './note.routes';
import userRouter from './user.routes';
import referralRouter from './referral.routes';
import adminQuestionRouter from './admin/question.routes';
import adminTestRouter from './admin/test.routes';
import adminNoteRouter from './admin/note.routes';
import adminAcademicRouter from './admin/academic.routes';

const apiRouter: Router = Router();

apiRouter.use('/tests', testRouter);
apiRouter.use('/notes', noteRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/referrals', referralRouter);

// Admin routes — all protected by requireAdmin inside their respective routers
apiRouter.use('/admin/questions', adminQuestionRouter);
apiRouter.use('/admin/tests', adminTestRouter);
apiRouter.use('/admin/notes', adminNoteRouter);
apiRouter.use('/admin/academic', adminAcademicRouter);

export default apiRouter;
