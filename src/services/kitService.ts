import type { IUser } from '../models/User.js';

export async function submitEmailToKit(
  email: string,
  user: IUser
): Promise<{ ok: boolean }> {
  console.log('KIT PLACEHOLDER', { email, userId: user.telegramUserId });
  return { ok: true };
}
