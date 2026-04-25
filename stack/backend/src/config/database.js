import mongoose from 'mongoose';
import { env } from './env.js';

let connectPromise = null;

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectPromise) {
    mongoose.set('strictQuery', true);
    connectPromise = mongoose.connect(env.MONGO_URI, {
      autoIndex: true,
      serverSelectionTimeoutMS: 10000
    });
  }

  await connectPromise;
  return mongoose.connection;
}
