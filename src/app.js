// src/app.js
import { connectDb } from './config/db.js';
import { createBot } from './bot/bot.js';

async function main() {
  await connectDb();
  createBot();
  console.log('Bot started');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});