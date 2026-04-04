import TelegramBot, {Message} from "node-telegram-bot-api";
import {TELEGRAM_BOT_TOKEN} from "../config/env.js";
import {
  handleStart,
  handleText,
  handleCallback,
  handleHelp,
} from "./handlers.js";
import {setUpUserAndBackup} from "../services/helpers/index.js";

export function createBot(): TelegramBot {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN");
  }

  const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {polling: true});

  bot.onText(/\/start/, async (msg) => {
    try {
      const user = await setUpUserAndBackup(msg);

      await handleStart(bot, msg, user);
    } catch (error) {
      console.error("Error handling start command:", error);
    }
  });

  bot.onText(/\/help/, async (msg) => {
    try {
      await setUpUserAndBackup(msg);

      await handleHelp(bot, msg);
    } catch (error) {
      console.error("Error handling help command:", error);
    }
  });

  bot.on("message", async (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;

    try {
      const user = await setUpUserAndBackup(msg);

      await handleText(bot, msg, user);
    } catch (error) {
      console.error("Error handling text command:", error);
    }
  });

  bot.on("callback_query", async (query) => {
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

    try {
      const user = await setUpUserAndBackup(msg);

      await handleCallback(bot, query, user);

      await bot.answerCallbackQuery(query.id);
    } catch (error) {
      console.error("Error handling callback query:", error);
    }
  });

  return bot;
}
