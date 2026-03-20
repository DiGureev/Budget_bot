// src/bot/bot.js
import TelegramBot from 'node-telegram-bot-api';
import { TELEGRAM_BOT_TOKEN } from '../config/env.js';
import { getOrCreateUser } from '../services/userService.js';
import { ensureDailyBackup } from '../services/backupService.js';
import { ensureUserPeriodsCurrent } from '../services/rolloverService.js';
import { handleStart, handleText, handleCallback } from './handlers.js';

export function createBot() {
  const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

  bot.onText(/\/start/, async (msg) => {
    const { user } = await getOrCreateUser(msg);
    await ensureDailyBackup();
    await ensureUserPeriodsCurrent(user.telegramUserId);
    await handleStart(bot, msg, user);
  });

  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/start')) return;

    const { user } = await getOrCreateUser(msg);
    await ensureDailyBackup();
    await ensureUserPeriodsCurrent(user.telegramUserId);
    await handleText(bot, msg, user);
  });

  bot.on('callback_query', async (query) => {
    const fakeMsg = {
      from: query.from,
      chat: query.message.chat,
    };

    const { user } = await getOrCreateUser(fakeMsg);
    await ensureDailyBackup();
    await ensureUserPeriodsCurrent(user.telegramUserId);
    await handleCallback(bot, query, user);
    await bot.answerCallbackQuery(query.id);
  });

  return bot;
}