import BackupLog, { type IBackupLog } from '../models/BackupLog.js';
import { getNowParts } from '../utils/dates.js';
import { runGoogleBackup } from './googleBackupService.js';

export async function ensureDailyBackup(): Promise<IBackupLog | null> {
  const { dateKey } = getNowParts();

  const existing = await BackupLog.findOne({ dateKey });
  if (existing?.status === 'success') {
    console.log('backup already exists');
    return existing;
  }

  let log: IBackupLog | null;
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

  if (!log) {
    return null;
  }

  try {
    await runGoogleBackup();

    log.status = 'success';
    log.finishedAt = new Date();
    await log.save();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown backup error';
    log.status = 'failed';
    log.error = message;
    log.finishedAt = new Date();
    await log.save();
  }

  return log;
}
