// src/models/BackupLog.js
import mongoose from 'mongoose';

const BackupLogSchema = new mongoose.Schema(
  {
    dateKey: { type: String, required: true, unique: true, index: true }, // YYYY-MM-DD
    status: { type: String, enum: ['running', 'success', 'failed'], required: true },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('BackupLog', BackupLogSchema);