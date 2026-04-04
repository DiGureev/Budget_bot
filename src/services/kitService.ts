import { type IUser } from '../types.js';
import { KIT_API_KEY, KIT_TAG_ID } from '../config/env.js';


export async function submitEmailToKit(
  email: string,
  user: IUser
): Promise<{ ok: boolean }> {
  try {
    const response = await fetch(
      `https://api.convertkit.com/v3/tags/${KIT_TAG_ID}/subscribe`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: KIT_API_KEY,
          email,
          first_name: user.firstName || undefined,
          fields: {
            telegramUserId: user.telegramUserId,
            username: user.username,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('KIT ERROR', data);
      return { ok: false };
    }

    console.log('KIT SUCCESS', data);

    return { ok: true };
  } catch (error) {
    console.error('KIT FETCH ERROR', error);
    return { ok: false };
  }
}