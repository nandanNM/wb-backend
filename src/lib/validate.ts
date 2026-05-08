import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';

export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const msg = result.error.issues.map((i) => i.message).join('; ');
    throw new AppError(400, msg);
  }
  return result.data;
}
