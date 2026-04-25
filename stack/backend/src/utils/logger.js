import morgan from 'morgan';

function timestamp() {
  return new Date().toISOString();
}

morgan.token('ts', () => timestamp());
morgan.token('bodySize', (_req, res) => res.getHeader('content-length') || '-');
morgan.token('reqId', (req) => req.id || '-');

export const requestLogger = morgan(
  ':ts :method :url :status :response-time ms - :res[content-length] bytes'
);

export function logInfo(message, meta = {}) {
  console.log(`[${timestamp()}] INFO ${message}`, meta);
}

export function logWarn(message, meta = {}) {
  console.warn(`[${timestamp()}] WARN ${message}`, meta);
}

export function logError(message, meta = {}) {
  console.error(`[${timestamp()}] ERROR ${message}`, meta);
}
