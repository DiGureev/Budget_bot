import dotenv from "dotenv";
dotenv.config();

import express from "express";
import TelegramBot from "node-telegram-bot-api";
import type {CallbackQuery, Message} from "node-telegram-bot-api";
import {connectDb} from "../src/config/db.js";
import {
  handleStart,
  handleText,
  handleCallback,
  handleHelp,
} from "../src/bot/handlers.js";
import {getOrCreateUser} from "../src/services/userService.js";
import {ensureDailyBackup} from "../src/services/backupService.js";
import {ensureUserPeriodsCurrent} from "../src/services/rolloverService.js";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const WEBHOOK_SECRET_PATH = process.env.WEBHOOK_SECRET_PATH!;
const APP_BASE_URL = process.env.APP_BASE_URL!;

const bot = new TelegramBot(TOKEN, {polling: false});
const app = express();
app.use(express.json());

let dbReady = false;
async function ensureDb() {
  if (!dbReady) {
    await connectDb();
    dbReady = true;
  }
}

app.get("/", (_req, res) => res.status(200).send("OK"));

app.post(`/${WEBHOOK_SECRET_PATH}`, async (req, res) => {
  try {
    await ensureDb();
    const update = req.body;

    if (update.message) {
      await processMessage(update.message);
    } else if (update.callback_query) {
      await processCallback(update.callback_query);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    res.sendStatus(500);
  }
});

async function processMessage(msg: Message) {
  const {user} = await getOrCreateUser(msg);
  await ensureDailyBackup();
  await ensureUserPeriodsCurrent(user.telegramUserId);

  if (msg.text?.startsWith("/start")) {
    await handleStart(bot, msg, user);
    return;
  }
  if (msg.text?.startsWith("/help")) {
    await handleHelp(bot, msg);
    return;
  }
  if (msg.text) {
    await handleText(bot, msg, user);
  }
}

async function processCallback(query: CallbackQuery) {
  if (
    !query.message?.chat ||
    !query.message?.message_id ||
    !query.message?.date
  )
    return;

  const msg: Message = {
    from: query.from,
    chat: query.message.chat,
    message_id: query.message.message_id,
    date: query.message.date,
  };

  const {user} = await getOrCreateUser(msg);
  await ensureDailyBackup();
  await ensureUserPeriodsCurrent(user.telegramUserId);
  await handleCallback(bot, query, user);
  await bot.answerCallbackQuery(query.id);
}

// Register webhook on cold start
(async () => {
  await ensureDb();
  await bot.setMyCommands([
    {command: "start", description: "Start the bot"},
    {command: "help", description: "Help"},
  ]);
  if (APP_BASE_URL) {
    await bot.setWebHook(`${APP_BASE_URL}/${WEBHOOK_SECRET_PATH}`);
  }
})();

export default app;
