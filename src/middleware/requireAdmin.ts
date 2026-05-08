import { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth';
import { AppError } from './errorHandler';
import type { AuthRequest } from './requireAuth';

export async function requireAdmin(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user) {
      next(new AppError(401, 'Unauthorized'));
      return;
    }
    const role = (session.user as { role?: string }).role;
    if (role !== 'admin') {
      next(new AppError(403, 'Forbidden: admin access required'));
      return;
    }
    (req as AuthRequest).userId = session.user.id;
    next();
  } catch {
    next(new AppError(401, 'Unauthorized'));
  }
}
