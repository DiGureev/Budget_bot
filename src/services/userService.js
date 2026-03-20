import User from '../models/User.js';

export async function getOrCreateUser(msg) {
  const telegramUserId = msg.from.id;
  const chatId = msg.chat.id;

  let user = await User.findOne({ telegramUserId });

  if (!user) {
    user = await User.create({
      telegramUserId,
      chatId,
      username: msg.from.username || null,
      firstName: msg.from.first_name || null,
      onboarding: {
        emailSubmitted: false,
        completed: false,
      },
      state: {
        step: 'awaiting_email',
        payload: {},
      },
      lastSeenAt: new Date(),
    });
    return { user, isNew: true };
  }

  user.chatId = chatId;
  user.username = msg.from.username || user.username;
  user.firstName = msg.from.first_name || user.firstName;
  user.lastSeenAt = new Date();
  await user.save();

  return { user, isNew: false };
}

export async function setUserState(userId, step, payload = {}) {
  return User.findOneAndUpdate(
    { telegramUserId: userId },
    { $set: { state: { step, payload } } },
    { new: true }
  );
}

export async function setDefaultCategory(userId, categoryId) {
  return User.findOneAndUpdate(
    { telegramUserId: userId },
    { $set: { defaultCategoryId: categoryId } },
    { new: true }
  );
}

export async function clearDefaultCategory(userId) {
  return User.findOneAndUpdate(
    { telegramUserId: userId },
    { $set: { defaultCategoryId: null } },
    { new: true }
  );
}
