// export async function runDropboxBackup(): Promise<{ ok: boolean }> {
//   console.log('DROPBOX BACKUP PLACEHOLDER');
//   return { ok: true };
// }

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Dropbox } from 'dropbox';
import { DROPBOX_TOKEN, MONGODB_URI } from '../config/env.js';
import { createReadStream } from 'fs';

const execAsync = promisify(exec);

function getBackupFileName(): string {
  const now = new Date();

  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');

  return `mongodb-backup-${year}-${month}-${day}_${hours}-${minutes}-${seconds}.archive.gz`;
}

async function createMongoDump(filePath: string): Promise<void> {
  if (!MONGODB_URI) {
    throw new Error('MONGO_URI is missing');
  }

  const command = `mongodump --uri="${MONGODB_URI}" --archive | gzip > "${filePath}"`;

  await execAsync(command);
}

export async function runDropboxBackup(): Promise<{ ok: boolean }> {
  if (!DROPBOX_TOKEN) {
    throw new Error('DROPBOX_TOKEN is missing');
  }

  const dbx = new Dropbox({ accessToken: DROPBOX_TOKEN });

  const fileName = getBackupFileName();
  const tempFilePath = path.join(os.tmpdir(), fileName);

  try {
    await createMongoDump(tempFilePath);

    const stats = await fs.stat(tempFilePath);
    console.log(`Backup size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    const stream = createReadStream(tempFilePath);

    await dbx.filesUpload({
      path: `/${fileName}`,
      contents: stream,
      mode: { '.tag': 'add' },
      autorename: true,
      mute: true,
    });

    await cleanupDropbox(dbx);

    console.log('Dropbox backup uploaded:', fileName);

    return { ok: true };
  } catch (error) {
    console.error('Dropbox backup failed:', error);
    throw error;
  } finally {
    try {
      await fs.unlink(tempFilePath);
    } catch (error) {
      console.error('Error deleting temp file:', error);
    }
  }
}

async function cleanupDropbox(dbx: Dropbox) {
  const res = await dbx.filesListFolder({ path: '' });

  const backups = res.result.entries
    .filter((f: any) => f.name.startsWith('mongodb-backup-'))
    .sort((a: any, b: any) => {
      return (
        new Date(b.server_modified).getTime() -
        new Date(a.server_modified).getTime()
      );
    });

  const toDelete = backups.slice(7); // keep only 7 newest

  for (const file of toDelete) {
    console.log('Deleting old backup:', file.name);

    if (!file.path_lower) {
      console.error('File path is missing:', file);
      continue;
    }

    await dbx.filesDeleteV2({
      path: file.path_lower,
    });
  }
}