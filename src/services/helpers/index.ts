import { Message } from "node-telegram-bot-api";
import { ensureDailyBackup } from "../../services/backupService.js";
import { ensureUserPeriodsCurrent } from "../../services/rolloverService.js";
import { getOrCreateUser } from "../../services/userService.js";
import { type UserDocument } from "../../types.js";

export const setUpUserAndBackup = async (msg: Message): Promise<UserDocument> => {

    if (!msg.from || !msg.chat) {
        throw new Error('Invalid message');
    }
    
    const { user } = await getOrCreateUser(msg);
    await ensureDailyBackup();
    await ensureUserPeriodsCurrent(user.telegramUserId);
    return user
}