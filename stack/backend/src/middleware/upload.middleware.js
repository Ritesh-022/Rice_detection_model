import multer from 'multer';
import { env } from '../config/env.js';

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const allowed = new Set(['image/jpeg', 'image/jpg', 'image/png']);
  if (!allowed.has(file.mimetype)) {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Only JPG, JPEG, and PNG are allowed.`), false);
    return;
  }

  cb(null, true);
}

export const uploadImages = multer({
  storage,
  fileFilter,
  limits: {
    files: env.MAX_UPLOAD_FILES,
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024
  }
}).any();
