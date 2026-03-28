import TelegramBot from 'node-telegram-bot-api';
import { TELEGRAM_BOT_TOKEN } from '../config/env.js';
import { getOrCreateUser } from '../services/userService.js';
import { ensureDailyBackup } from '../services/backupService.js';
import { ensureUserPeriodsCurrent } from '../services/rolloverService.js';
import { handleStart, handleText, handleCallback } from './handlers.js';
export function createBot() {
    if (!TELEGRAM_BOT_TOKEN) {
        throw new Error('Missing TELEGRAM_BOT_TOKEN');
    }
    const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
    bot.onText(/\/start/, async (msg) => {
        if (!msg.from || !msg.chat)
            return;
        const { user } = await getOrCreateUser({ from: msg.from, chat: msg.chat });
        await ensureDailyBackup();
        await ensureUserPeriodsCurrent(user.telegramUserId);
        await handleStart(bot, msg, user);
    });
    bot.on('message', async (msg) => {
        if (!msg.text || msg.text.startsWith('/start'))
            return;
        if (!msg.from || !msg.chat)
            return;
        const { user } = await getOrCreateUser({ from: msg.from, chat: msg.chat });
        await ensureDailyBackup();
        await ensureUserPeriodsCurrent(user.telegramUserId);
        await handleText(bot, msg, user);
    });
    bot.on('callback_query', async (query) => {
        if (!query.message || !('chat' in query.message))
            return;
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
