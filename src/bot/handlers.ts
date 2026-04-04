import type TelegramBot from "node-telegram-bot-api";
import type {CallbackQuery, Message} from "node-telegram-bot-api";
import {type ICategory, type UserDocument} from "../types.js";
import {parseAmount} from "../services/amountParser.js";
import {
  getActiveCategories,
  getCategoryById,
  applyAmount,
  archiveCategory,
} from "../services/categoryService.js";
import {
  getDefaultCategoryById,
  getValidatedState,
} from "../services/userService.js";
import {
  getCategoryButtonLabel,
  categoriesReplyKeyboard,
  categoryActionsKeyboard,
} from "./keyboards.js";
import {formatCategoryDetails} from "./messages.js";
import {
  WELCOME_MESSAGE,
  BOT_STARTED_MESSAGE,
  CATEGORY_NOT_FOUND_ERROR,
  NOT_DEFAULT_CATEGORY_ERROR,
  HELP_MESSAGE,
  CATEGORY_REMOVED,
} from "./constants.js";

function categoryKeyboardOptions(categories: ICategory[], user: UserDocument) {
  return {
    reply_markup: categoriesReplyKeyboard(categories, user),
  };
}

const resetUser = async (user: UserDocument) => {
  user.state = {step: null, context: null, payload: {}};
  await user.save();
};

export async function handleHelp(
  bot: TelegramBot,
  msg: Message,
): Promise<void> {
  await bot.sendMessage(msg.chat.id, HELP_MESSAGE, {parse_mode: "HTML"});
}

export async function handleStart(
  bot: TelegramBot,
  msg: Message,
  user: UserDocument,
  context: {ownerId: number; ownerType: "user" | "group"},
): Promise<void> {
  if (!user.onboarding.emailSubmitted) {
    await bot.sendMessage(msg.chat.id, WELCOME_MESSAGE, {parse_mode: "HTML"});
    return;
  }

  await resetUser(user);

  const defaultCategoryId = await getDefaultCategoryById(user.telegramUserId);
  const categories = await getActiveCategories(context);

  let message: string;

  if (defaultCategoryId) {
    const defaultCat = await getCategoryById(defaultCategoryId, context);
    const displayName = defaultCat?.name ?? "default";
    message = `${BOT_STARTED_MESSAGE} Send spending for "${displayName}".`;
  } else if (categories.length) {
    message = `${BOT_STARTED_MESSAGE} Choose a category.`;
  } else {
    message = `${BOT_STARTED_MESSAGE} Add categories to start.`;
  }

  await bot.sendMessage(msg.chat.id, message, {
    parse_mode: "HTML",
    ...categoryKeyboardOptions(categories, user),
  });
}

export async function handleText(
  bot: TelegramBot,
  msg: Message,
  user: UserDocument,
  context: {ownerId: number; ownerType: "user" | "group"},
): Promise<void> {
  const text = (msg.text || "").trim();

  const state = await getValidatedState(user, context);
  const step = state?.step;

  const activeCategories = await getActiveCategories(context);

  const selectedCategory = activeCategories.find(
    (c) => text === getCategoryButtonLabel(c, user),
  );

  if (selectedCategory) {
    user.state = {
      step: "awaiting_category_amount",
      context,
      payload: {categoryId: String(selectedCategory._id)},
    };
    await user.save();

    await bot.sendMessage(
      msg.chat.id,
      formatCategoryDetails(selectedCategory),
      {reply_markup: categoryActionsKeyboard(selectedCategory)},
    );
    return;
  }

  if (!step) {
    const amount = parseAmount(text);

    if (amount === null) {
      await bot.sendMessage(msg.chat.id, "Unknown input.");
      return;
    }

    if (!user.defaultCategoryId) {
      await bot.sendMessage(msg.chat.id, NOT_DEFAULT_CATEGORY_ERROR, {
        parse_mode: "HTML",
      });
      return;
    }

    const category = await getCategoryById(user.defaultCategoryId, context);

    if (!category) {
      await bot.sendMessage(msg.chat.id, CATEGORY_NOT_FOUND_ERROR);
      return;
    }

    await applyAmount(category, amount);

    const categories = await getActiveCategories(context);

    await bot.sendMessage(
      msg.chat.id,
      formatCategoryDetails(category, false),
      categoryKeyboardOptions(categories, user),
    );

    return;
  }

  await bot.sendMessage(msg.chat.id, "Unknown input.");
}

export async function handleCallback(
  bot: TelegramBot,
  query: CallbackQuery,
  user: UserDocument,
  context: {ownerId: number; ownerType: "user" | "group"},
): Promise<void> {
  const data = query.data;
  if (!data || !query.message || !("chat" in query.message)) return;

  const chatId = query.message.chat.id;

  if (data.startsWith("remove:")) {
    const categoryId = data.split(":")[1];
    const category = await getCategoryById(categoryId, context);

    if (!category) {
      await bot.sendMessage(chatId, CATEGORY_NOT_FOUND_ERROR);
      return;
    }

    await archiveCategory(category);

    const categories = await getActiveCategories(context);

    await bot.sendMessage(
      chatId,
      CATEGORY_REMOVED(category.name),
      categoryKeyboardOptions(categories, user),
    );

    return;
  }

  await bot.sendMessage(chatId, "Unknown action");
}
