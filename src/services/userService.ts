import type {Message} from "node-telegram-bot-api";
import User from "../models/User.js";
import type {IUser} from "../types.js";

type Context = {
  ownerId: number;
  ownerType: "user" | "group";
};

export function getContext(msg: Message): Context {
  const isPrivate = msg.chat.type === "private";

  return {
    ownerId: isPrivate ? msg.from!.id : msg.chat.id,
    ownerType: isPrivate ? "user" : "group",
  };
}

export async function getOrCreateUser(msg: Message) {
  if (!msg.from) {
    throw new Error("Message from is missing");
  }

  const telegramUserId = msg.from.id;
  const chatId = msg.chat.id;

  let user = await User.findOne({telegramUserId});

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
        step: "awaiting_email",
        context: null, // 🔥 important
        payload: {},
      },
      lastSeenAt: new Date(),
    });

    return {user, isNew: true};
  }

  user.chatId = chatId;
  user.username = msg.from.username || user.username;
  user.firstName = msg.from.first_name || user.firstName;
  user.lastSeenAt = new Date();

  await user.save();

  return {user, isNew: false};
}

export async function setUserState(
  userId: number,
  context: Context,
  step: string | null,
  payload: Record<string, unknown> = {},
): Promise<IUser | null> {
  return User.findOneAndUpdate(
    {telegramUserId: userId},
    {
      $set: {
        state: {
          step,
          context, // 🔥 critical fix
          payload,
        },
      },
    },
    {new: true},
  );
}

export async function clearUserState(userId: number): Promise<IUser | null> {
  return User.findOneAndUpdate(
    {telegramUserId: userId},
    {
      $set: {
        state: {
          step: null,
          context: null,
          payload: {},
        },
      },
    },
    {new: true},
  );
}

export async function getValidatedState(
  user: IUser,
  context: Context,
): Promise<IUser["state"] | null> {
  if (!user.state?.step) return null;

  if (
    user.state.context?.ownerId !== context.ownerId ||
    user.state.context?.ownerType !== context.ownerType
  ) {
    return null;
  }

  return user.state;
}

export async function setDefaultCategory(
  userId: number,
  categoryId: string,
): Promise<IUser | null> {
  return User.findOneAndUpdate(
    {telegramUserId: userId},
    {$set: {defaultCategoryId: categoryId}},
    {new: true},
  );
}

export async function getDefaultCategoryById(
  userId: number,
): Promise<string | null> {
  const user = await User.findOne({telegramUserId: userId}).select(
    "defaultCategoryId",
  );

  return user?.defaultCategoryId ?? null;
}

export async function clearDefaultCategory(
  userId: number,
): Promise<IUser | null> {
  return User.findOneAndUpdate(
    {telegramUserId: userId},
    {$set: {defaultCategoryId: null}},
    {new: true},
  );
}
