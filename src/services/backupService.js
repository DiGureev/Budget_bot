// src/services/backupService.js
import BackupLog from '../models/BackupLog.js';
import { getNowParts } from '../utils/dates.js';
import { runGoogleBackup } from './googleBackupService.js';

export async function ensureDailyBackup() {
  const { dateKey } = getNowParts();

  const existing = await BackupLog.findOne({ dateKey });
  if (existing?.status === 'success') {
    console.log('backup already exists');
    return existing;
  }

  let log;
  try {
     log = await BackupLog.findOneAndUpdate(
      { dateKey },
      {
        status: 'running',
        startedAt: new Date(),
        finishedAt: null,
        error: null,
      },
      {
        upsert: true,
        new: true,
      }
    );
  } catch (err) {
    console.error('error creating backup log', err);
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
