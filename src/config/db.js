// src/config/db.js
import mongoose from 'mongoose';
import { MONGODB_URI } from './env.js';

export async function connectDb() {
  if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI');
  }

  await mongoose.connect(MONGODB_URI);
  console.log('Mongo connected');
}