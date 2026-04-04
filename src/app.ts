import express from "express";
import TelegramBot from "node-telegram-bot-api";
import type {CallbackQuery, Message} from "node-telegram-bot-api";
import dotenv from "dotenv";

import {connectDb} from "./config/db.js";
import {
  handleStart,
  handleText,
  handleCallback,
  handleHelp,
} from "./bot/handlers.js";
import {
  getOrCreateUser,
  getContext, // 🔥 ADD
} from "./services/userService.js";
import {ensureDailyBackup} from "./services/backupService.js";
import {ensureContextPeriodsCurrent} from "./services/rolloverService.js"; // 🔥 CHANGED

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MODE = process.env.MODE || "dev";
const PORT = process.env.PORT || 10000;
const WEBHOOK_SECRET_PATH = process.env.WEBHOOK_SECRET_PATH;
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;

if (!TOKEN) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN");
}

const bot = new TelegramBot(TOKEN, {polling: false});
const app = express();

app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).send("OK");
});

async function processMessage(msg: Message) {
  const {user} = await getOrCreateUser(msg);

  const context = getContext(msg); // 🔥 ADD

  await ensureDailyBackup();
  await ensureContextPeriodsCurrent(context); // 🔥 FIX

  if (msg.text && msg.text.startsWith("/start")) {
    await handleStart(bot, msg, user, context); // 🔥 PASS
    return;
  }

  if (msg.text && msg.text.startsWith("/help")) {
    await handleHelp(bot, msg); // (no need context)
    return;
  }

  if (msg.text) {
    await handleText(bot, msg, user, context); // 🔥 PASS
  }
}

async function processCallback(query: CallbackQuery) {
  if (
    !query.message?.chat ||
    !query.message?.message_id ||
    !query.message?.date
  ) {
    return;
  }

  const msg: Message = {
    from: query.from,
    chat: query.message.chat,
    message_id: query.message.message_id,
    date: query.message.date,
  };

  const {user} = await getOrCreateUser(msg);

  const context = getContext(msg); // 🔥 ADD

  await ensureDailyBackup();
  await ensureContextPeriodsCurrent(context); // 🔥 FIX

  await handleCallback(bot, query, user, context); // 🔥 PASS
  await bot.answerCallbackQuery(query.id);
}

async function main() {
  await connectDb();

  await bot.setMyCommands([
    {command: "start", description: "Start the bot"},
    {command: "help", description: "Help"},
  ]);

  if (MODE === "dev") {
    console.log("Running in DEV (polling mode)");

    bot.startPolling();

    bot.on("message", async (msg) => {
      try {
        await processMessage(msg);
      } catch (err) {
        console.error("Message handling error:", err);
      }
    });

    bot.on("callback_query", async (query) => {
      try {
        await processCallback(query);
      } catch (err) {
        console.error("Callback handling error:", err);
      }
    });

    return;
  }

  console.log("Running in PROD (webhook mode)");

  app.post(`/${WEBHOOK_SECRET_PATH}`, async (req, res) => {
    try {
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

  app.listen(PORT, async () => {
    console.log(`Server running on ${PORT}`);

    if (!RENDER_EXTERNAL_URL) {
      console.log("Missing RENDER_EXTERNAL_URL, webhook was not set");
      return;
    }

    const webhookUrl = `${RENDER_EXTERNAL_URL}/${WEBHOOK_SECRET_PATH}`;
    await bot.setWebHook(webhookUrl);
    console.log(`Webhook set: ${webhookUrl}`);
  });
}

main().catch((err) => {
  console.error("Startup error:", err);
  process.exit(1);
});
