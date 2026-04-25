import { Router } from 'express';
import legacyRoutes from '../src/routes/index.js';
import analysisRoutes from './analysis.routes.js';
import healthRoutes from './health.routes.js';
import notifyRoutes from './notify.routes.js';
import { getAnalysisResult } from '../controllers/analysis.controller.js';

const router = Router();

router.use('/', legacyRoutes);
router.use('/v1', healthRoutes);
router.use('/v1', analysisRoutes);
router.use('/v1', notifyRoutes);
router.get('/analysis/:uuid', getAnalysisResult);

export default router;
