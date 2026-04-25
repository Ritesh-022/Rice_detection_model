import { Router } from 'express';
import { createAnalysisJob, getAnalysisResult } from '../controllers/analysis.controller.js';
import { emailPdf, getPdf } from '../controllers/pdf.controller.js';
import { uploadImages } from '../src/middleware/upload.middleware.js';

const router = Router();

router.post('/analyze', uploadImages, createAnalysisJob);
router.get('/result/:uuid', getAnalysisResult);
router.get('/pdf/:uuid', getPdf);
router.post('/pdf/:uuid/email', emailPdf);

export default router;
