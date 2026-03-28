import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IBackupLog extends Document {
  dateKey: string;
  status: 'running' | 'success' | 'failed';
  startedAt: Date | null;
  finishedAt: Date | null;
  error: string | null;
}

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
