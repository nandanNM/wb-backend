import { Router } from 'express';
import testRouter from './test.routes';
import noteRouter from './note.routes';
import userRouter from './user.routes';
import referralRouter from './referral.routes';
import adminQuestionRouter from './admin/question.routes';

const apiRouter: Router = Router();

apiRouter.use('/tests', testRouter);
apiRouter.use('/notes', noteRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/referrals', referralRouter);

// Admin routes — all protected by requireAdmin inside their respective routers
apiRouter.use('/admin/questions', adminQuestionRouter);

export default apiRouter;
