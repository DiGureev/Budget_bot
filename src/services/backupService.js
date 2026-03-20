// src/services/backupService.js
import BackupLog from '../models/BackupLog.js';
import { getNowParts } from '../utils/dates.js';
import { runGoogleBackup } from './googleBackupService.js';

export async function ensureDailyBackup() {
  const { dateKey } = getNowParts();

  const existing = await BackupLog.findOne({ dateKey });
  if (existing) return existing;

  let log;
  try {
    log = await BackupLog.create({
      dateKey,
      status: 'running',
      startedAt: new Date(),
    });
  } catch (err) {
    return BackupLog.findOne({ dateKey });
  }

  try {
    await runGoogleBackup();

    log.status = 'success';
    log.finishedAt = new Date();
    await log.save();
  } catch (err) {
    log.status = 'failed';
    log.error = err.message || 'Unknown backup error';
    log.finishedAt = new Date();
    await log.save();
  }

  return log;
}
