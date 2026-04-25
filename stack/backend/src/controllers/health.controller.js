import mongoose from 'mongoose';
import { getQueueSnapshotSync } from '../services/analysisQueue.service.js';
import { checkFlaskHealth } from '../services/flaskClient.service.js';

export async function getHealthStatus(req, res) {
  const flask = await checkFlaskHealth().catch((error) => ({
    healthy: false,
    error: error.message
  }));

  res.json({
    success: true,
    status: 'healthy',
    database: {
      connected: mongoose.connection.readyState === 1
    },
    flask,
    queue: getQueueSnapshotSync()
  });
}
