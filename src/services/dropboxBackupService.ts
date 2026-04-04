import fs from "fs/promises";
import path from "path";
import os from "os";
import {createReadStream} from "fs";
import {Dropbox} from "dropbox";
import {DROPBOX_TOKEN} from "../config/env.js";
import User from "../models/User.js";
import Category from "../models/Category.js";

function getBackupFileName(): string {
  const now = new Date();

  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hours = String(now.getUTCHours()).padStart(2, "0");
  const minutes = String(now.getUTCMinutes()).padStart(2, "0");
  const seconds = String(now.getUTCSeconds()).padStart(2, "0");

  return `mongodb-backup-${year}-${month}-${day}_${hours}-${minutes}-${seconds}.json`;
}

async function createMongoDump(filePath: string): Promise<void> {
  console.log("Creating JSON backup...");

  const users = await User.find().lean();
  const categories = await Category.find().lean();

  const backup = {
    exportedAt: new Date().toISOString(),
    users,
    categories,
  };

  await fs.writeFile(filePath, JSON.stringify(backup, null, 2));
}

export async function runDropboxBackup(): Promise<{ok: boolean}> {
  if (!DROPBOX_TOKEN) {
    throw new Error("DROPBOX_TOKEN is missing");
  }

  const dbx = new Dropbox({accessToken: DROPBOX_TOKEN});

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
      mode: {".tag": "add"},
      autorename: true,
      mute: true,
    });

    await cleanupDropbox(dbx);

    console.log("Dropbox backup uploaded:", fileName);

    return {ok: true};
  } catch (error) {
    console.error("Dropbox backup failed:", error);
    throw error;
  } finally {
    try {
      await fs.unlink(tempFilePath);
    } catch (error) {
      console.error("Error deleting temp file:", error);
    }
  }
}

async function cleanupDropbox(dbx: Dropbox) {
  const res = await dbx.filesListFolder({path: ""});

  const backups = res.result.entries
    .filter((f: any) => f.name.startsWith("mongodb-backup-"))
    .sort((a: any, b: any) => {
      return (
        new Date(b.server_modified).getTime() -
        new Date(a.server_modified).getTime()
      );
    });

  const toDelete = backups.slice(7); // keep 7 newest

  for (const file of toDelete) {
    console.log("Deleting old backup:", file.name);

    if (!file.path_lower) continue;

    await dbx.filesDeleteV2({
      path: file.path_lower,
    });
  }
}
