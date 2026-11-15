import mongoose from 'mongoose';
import { env } from './env';

/**
 * Établit la connexion Mongoose vers MongoDB.
 */
export async function connectDB(uri: string = env.MONGO_URI): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  return mongoose.connect(uri);
}

/**
 * Ferme proprement la connexion Mongoose active.
 */
export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
