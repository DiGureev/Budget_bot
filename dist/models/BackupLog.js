import mongoose, { Schema } from 'mongoose';
const BackupLogSchema = new Schema({
    dateKey: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ['running', 'success', 'failed'], required: true },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    error: { type: String, default: null },
}, { timestamps: true });
const BackupLog = mongoose.model('BackupLog', BackupLogSchema);
export default BackupLog;
