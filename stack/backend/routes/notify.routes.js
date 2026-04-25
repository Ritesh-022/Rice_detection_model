import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { notifyByEmail } from '../controllers/notify.controller.js';

const router = Router();

const emailRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: {
    success: false,
    error: { message: 'Too many email requests. Please wait a minute and try again.' }
  },
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

router.post('/notify/email', emailRateLimit, notifyByEmail);

export default router;
