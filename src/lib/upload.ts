import multer from 'multer';
import { AppError } from '../middleware/errorHandler';

// Dummy upload result — swap out for S3/R2/GCS in production
export interface UploadResult {
  url: string;
  key: string;
  sizeBytes: number;
  mimeType: string;
}

export async function uploadFile(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<UploadResult> {
  const key = `uploads/${Date.now()}-${filename}`;
  return {
    url: `https://cdn.example.com/${key}`,
    key,
    sizeBytes: buffer.length,
    mimeType,
  };
}

// Multer instance — memory storage keeps the file as a Buffer in req.file
export const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter(_req, file, cb) {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'Only CSV files are accepted'));
    }
  },
});
