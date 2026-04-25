import mongoose from 'mongoose';
import { checkFlaskHealth } from '../src/services/flaskClient.service.js';
import { getQueueSnapshotSync } from '../queue/index.js';

export async function getHealth(req, res, next) {
  try {
    const flask = await checkFlaskHealth().catch((error) => ({
      healthy: false,
      error: error.message
    }));

    return res.json({
      success: true,
      data: {
        server: {
          status: 'running',
          uptime: process.uptime()
        },
        mongodb: {
          connected: mongoose.connection.readyState === 1
        },
        flask: {
          healthy: Boolean(flask && flask.healthy !== false),
          details: flask
        },
        queue: getQueueSnapshotSync()
      }
    });
  } catch (error) {
    return next(error);
  }
}
