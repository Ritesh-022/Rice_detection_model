import { Router } from 'express';
import analysisRoutes from './analysis.routes.js';
import { getHealthStatus } from '../controllers/health.controller.js';

const router = Router();

router.get('/health', getHealthStatus);
router.use('/analysis', analysisRoutes);

export default router;
