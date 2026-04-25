import { Router } from 'express';
import {
  createAnalysisJob,
  getAnalysisJob,
  regeneratePdf,
  streamPdf,
  getQueueSnapshot
} from '../controllers/analysis.controller.js';
import { uploadImages } from '../middleware/upload.middleware.js';

const router = Router();

router.post('/', uploadImages, createAnalysisJob);
router.get('/queue', getQueueSnapshot);
router.get('/:jobId', getAnalysisJob);
router.get('/:jobId/pdf', streamPdf);
router.post('/:jobId/pdf/regenerate', regeneratePdf);

export default router;
