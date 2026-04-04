import mongoose, { Schema, type Model } from 'mongoose';
import { IBackupLog } from '../types.js';

const BackupLogSchema = new Schema<IBackupLog>(
  {
    dateKey: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ['running', 'success', 'failed'], required: true },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

const BackupLog: Model<IBackupLog> = mongoose.model<IBackupLog>('BackupLog', BackupLogSchema);
export default BackupLog;
