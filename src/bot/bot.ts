import TelegramBot, { Message } from 'node-telegram-bot-api';
import { TELEGRAM_BOT_TOKEN } from '../config/env.js';
import { getOrCreateUser } from '../services/userService.js';
import { ensureDailyBackup } from '../services/backupService.js';
import { ensureChatPeriodsCurrent } from '../services/rolloverService.js';
import { handleStart, handleText, handleCallback } from './handlers.js';

export function createBot(): TelegramBot {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('Missing TELEGRAM_BOT_TOKEN');
  }

  const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

  bot.onText(/\/start/, async (msg) => {
    if (!msg.from || !msg.chat) return;
    const { user } = await getOrCreateUser(msg);
    await ensureDailyBackup();
    await ensureChatPeriodsCurrent(user.chatId);
    await handleStart(bot, msg, user);
  });

  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/start')) return;
    if (!msg.from || !msg.chat) return;

    const { user } = await getOrCreateUser(msg);
    await ensureDailyBackup();
    await ensureChatPeriodsCurrent(user.chatId);
    await handleText(bot, msg, user);
  });

  bot.on('callback_query', async (query) => {
    if (!query.message?.chat || !query.message?.message_id || !query.message?.date) return;

    const msg: Message = {
      from: query.from,
      chat: query.message.chat,
      message_id: query.message.message_id,
      date: query.message.date,
    };

    const { user } = await getOrCreateUser(msg);
    await ensureDailyBackup();
    await ensureChatPeriodsCurrent(user.chatId);
    await handleCallback(bot, query, user);
    await bot.answerCallbackQuery(query.id);
  });

  return bot;
}
