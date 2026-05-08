import { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  userId: string;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user) {
      next(new AppError(401, 'Unauthorized'));
      return;
    }
    (req as AuthRequest).userId = session.user.id;
    next();
  } catch {
    next(new AppError(401, 'Unauthorized'));
  }
}
