import type TelegramBot from "node-telegram-bot-api";
import type {CallbackQuery, Message} from "node-telegram-bot-api";
import {CategoryType, type ICategory, type UserDocument} from "../types.js";
import {parseAmount} from "../services/amountParser.js";
import {
  countActiveCategories,
  getActiveCategories,
  getCategoryById,
  applyAmount,
  archiveCategory,
  resetCategorySpend,
  convertAnnualToMonthly,
} from "../services/categoryService.js";
import {
  setDefaultCategory,
  clearDefaultCategory,
  getDefaultCategoryById,
} from "../services/userService.js";
import {
  getCategoryButtonLabel,
  categoriesReplyKeyboard,
  categoryActionsKeyboard,
  defaultChoiceKeyboard,
  editCategoryKeyboard,
  confirmRemoveKeyboard,
} from "./keyboards.js";
import {
  formatCategoryDetails,
  formatMonthlyHistory,
  formatAnnualHistory,
  formatRemovePrompt,
  formatMoney,
} from "./messages.js";
import {
  WELCOME_MESSAGE,
  ACCOUNT_CREATED_MESSAGE,
  ADD_NEW_CATEGORY_MESSAGE,
  BOT_STARTED_MESSAGE,
  CATEGORIES_LIMIT_REACHED_ERROR,
  ENTER_CATEGORY_NAME_MESSAGE,
  CATEGORY_TYPE_CHOICE_MESSAGE,
  CATEGORY_CREATED_MESSAGE,
  MAKE_DEFAULT_CATEGORY_MESSAGE,
  DEFAULT_CATEGORY_SET_MESSAGE,
  AMOUNT_VALIDATION_ERROR,
  CATEGORY_NOT_FOUND_ERROR,
  NOT_DEFAULT_CATEGORY_ERROR,
  HELP_MESSAGE,
  CATEGORY_CONFIRM_WARNING,
  CATEGORY_TYPE_WARNING,
  CHOOSE_CATEGORY_TYPE_MESSAGE,
  CREATE_CATEGORY_WARNING,
  CATEGORY_CONFIRMATION_MESSAGE,
  CATEGORY_BUDGET_SET_MESSAGE,
  SEND_CATEGORY_NAME_MESSAGE,
  SEND_NEW_BUDGET_MESSAGE,
  BUDGET_RESET_MESSAGE,
  CATEGORY_TYPE_CONVERT_ERROR,
  CATEGORY_CONVERTED_TO_MONTHLY_MESSAGE,
  SET_DEFAULT_ERROR,
  DEFAULT_CATEGORY_REMOVED,
  CATEGORY_REMOVED,
  CATEGORY_CONVERTED_TO_ANNUAL_MESSAGE,
} from "./constants.js";
import {
  processCategoryBudgetUpdate,
  processRenameCategory,
  submitCategoryAmount,
  submitCategoryBudget,
  submitCategoryName,
  submitEmail,
} from "../services/helpers/index.js";

function categoryKeyboardOptions(categories: ICategory[], user: UserDocument) {
  return {
    reply_markup: categoriesReplyKeyboard(categories, user),
  };
}

export async function handleHelp(
  bot: TelegramBot,
  msg: Message,
): Promise<void> {
  await bot.sendMessage(msg.chat.id, HELP_MESSAGE, {parse_mode: "HTML"});
}

const resetUser = async (user: UserDocument) => {
  user.state = {step: null, payload: {}};
  await user.save();
};

export async function handleStart(
  bot: TelegramBot,
  msg: Message,
  user: UserDocument,
): Promise<void> {
  if (!user.onboarding.emailSubmitted) {
    await bot.sendMessage(msg.chat.id, WELCOME_MESSAGE, {parse_mode: "HTML"});
    return;
  }

  //reset on start
  await resetUser(user);

  const defaultCategoryId = await getDefaultCategoryById(user.telegramUserId);
  const categories = await getActiveCategories(user.telegramUserId);
  const hasCategories = categories.length > 0;
  let message: string;
  if (defaultCategoryId) {
    const defaultCat = await getCategoryById(
      defaultCategoryId,
      user.telegramUserId,
    );
    const displayName = defaultCat?.name ?? "default";
    message = `${BOT_STARTED_MESSAGE} Send the amount of spendings for default category "${displayName}".`;
  } else if (hasCategories) {
    message = `${BOT_STARTED_MESSAGE} Choose the category to add the spendings.`;
  } else {
    message = `${BOT_STARTED_MESSAGE} Add categories to start tracking your spending.`;
  }

  await bot.sendMessage(msg.chat.id, message, {
    parse_mode: "HTML",
    ...categoryKeyboardOptions(categories, user),
  });
}

export enum STEPS {
  EMAIL = "awaiting_email",
  DEFAULT_CATEGORY_CONFIRMATION = "awaiting_default_category_confirmation",
  CATEGORY_TYPE = "awaiting_category_type_choice",
  CATEGORY_TYPE_CONFIRMATION = "awaiting_category_type_confirmation",
  CATEGORY_NAME_SET = "awaiting_category_name",
  CATEGORY_BUGDET_SET = "awaiting_category_budget",
  CATEGORY_AMOUNT = "awaiting_category_amount",
  RENAME = "awaiting_rename",
  BUDGET_UPDATE = "awaiting_budget_update",
}

export async function handleText(
  bot: TelegramBot,
  msg: Message,
  user: UserDocument,
): Promise<void> {
  const text = (msg.text || "").trim();
  const step = user.state?.step;

  const activeCategories = await getActiveCategories(user.telegramUserId);
  const hasCategories = activeCategories.length > 0;
  if (
    user.onboarding.completed &&
    !hasCategories &&
    step === null &&
    text !== ADD_NEW_CATEGORY_MESSAGE
  ) {
    await bot.sendMessage(msg.chat.id, CREATE_CATEGORY_WARNING, {
      parse_mode: "HTML",
    });
    return;
  }

  const selectedCategory = activeCategories.find(
    (category) => text === getCategoryButtonLabel(category, user),
  );

  if (selectedCategory) {
    user.state = {
      step: STEPS.CATEGORY_AMOUNT,
      payload: {categoryId: String(selectedCategory._id)},
    };
    await user.save();

    await bot.sendMessage(
      msg.chat.id,
      formatCategoryDetails(selectedCategory),
      {
        reply_markup: categoryActionsKeyboard(selectedCategory),
      },
    );
    return;
  }

  if (text === ADD_NEW_CATEGORY_MESSAGE) {
    const count = await countActiveCategories(user.telegramUserId);

    if (count >= 8) {
      await bot.sendMessage(msg.chat.id, CATEGORIES_LIMIT_REACHED_ERROR, {
        parse_mode: "HTML",
        ...categoryKeyboardOptions(activeCategories, user),
      });
      return;
    }

    user.state = {step: STEPS.CATEGORY_NAME_SET, payload: {}};
    await user.save();

    await bot.sendMessage(msg.chat.id, ENTER_CATEGORY_NAME_MESSAGE, {
      parse_mode: "HTML",
      reply_markup: {remove_keyboard: true},
    });
    return;
  }

  if (step === STEPS.EMAIL) {
    const result = await submitEmail(text, user);

    if (!result.ok) {
      await bot.sendMessage(msg.chat.id, result.error ?? "Error");
      return;
    }

    const categories = await getActiveCategories(user.telegramUserId);

    await bot.sendMessage(msg.chat.id, ACCOUNT_CREATED_MESSAGE, {
      parse_mode: "HTML",
      ...categoryKeyboardOptions(categories, user),
    });

    return;
  }

  if (step === STEPS.DEFAULT_CATEGORY_CONFIRMATION) {
    await bot.sendMessage(msg.chat.id, CATEGORY_CONFIRM_WARNING);
    return;
  }

  if (step === STEPS.CATEGORY_TYPE_CONFIRMATION) {
    await bot.sendMessage(msg.chat.id, CATEGORY_TYPE_WARNING);
    return;
  }

  if (step === STEPS.CATEGORY_NAME_SET) {
    const result = await submitCategoryName(text, user, activeCategories);

    if (!result.ok) {
      await bot.sendMessage(msg.chat.id, result.error, {parse_mode: "HTML"});
      return; // ✅ FIX (missing before)
    }

    await bot.sendMessage(msg.chat.id, CATEGORY_TYPE_CHOICE_MESSAGE, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {text: "🗓️ Annual", callback_data: "cat_type:annual"},
            {text: "🌕 Monthly", callback_data: "cat_type:monthly"},
          ],
        ],
        remove_keyboard: true,
      },
    });
    return;
  }

  if (step === STEPS.CATEGORY_BUGDET_SET) {
    const result = await submitCategoryBudget(text, user);

    if (!result.ok) {
      await bot.sendMessage(msg.chat.id, result.error, {parse_mode: "HTML"});
      return;
    }

    const {category, type, amount} = result;

    if (type === "monthly") {
      await bot.sendMessage(
        msg.chat.id,
        MAKE_DEFAULT_CATEGORY_MESSAGE(category.name, formatMoney(amount)),
        {
          parse_mode: "HTML",
          reply_markup: defaultChoiceKeyboard(String(category._id)),
        },
      );
      return;
    }

    const categories = await getActiveCategories(user.telegramUserId);

    await bot.sendMessage(
      msg.chat.id,
      CATEGORY_CREATED_MESSAGE(category.name, formatMoney(amount), "annual"),
      {
        parse_mode: "HTML",
        ...categoryKeyboardOptions(categories, user),
      },
    );

    return;
  }

  if (step === STEPS.CATEGORY_AMOUNT) {
    const result = await submitCategoryAmount(text, user);

    if (!result.ok) {
      await bot.sendMessage(msg.chat.id, result.error, {parse_mode: "HTML"});
      return;
    }

    const categories = await getActiveCategories(user.telegramUserId);

    await bot.sendMessage(
      msg.chat.id,
      formatCategoryDetails(result.category, false),
      {
        ...categoryKeyboardOptions(categories, user),
      },
    );

    return;
  }

  if (step === STEPS.RENAME) {
    const result = await processRenameCategory(text, user);

    if (!result.ok) {
      await bot.sendMessage(msg.chat.id, result.error, {parse_mode: "HTML"});
      return;
    }

    const categories = await getActiveCategories(user.telegramUserId);

    await bot.sendMessage(
      msg.chat.id,
      `Category renamed to "${result.normalizedName}".`,
      categoryKeyboardOptions(categories, user),
    );
    return;
  }

  if (step === STEPS.BUDGET_UPDATE) {
    const result = await processCategoryBudgetUpdate(text, user);

    if (!result.ok) {
      await bot.sendMessage(msg.chat.id, result.error, {parse_mode: "HTML"});
      return;
    }

    await bot.sendMessage(
      msg.chat.id,
      `Budget updated to ${formatMoney(result.amount)}.`,
    );
    return;
  }

  if (step === STEPS.CATEGORY_TYPE) {
    await bot.sendMessage(msg.chat.id, CHOOSE_CATEGORY_TYPE_MESSAGE);
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

    const category = await getCategoryById(
      user.defaultCategoryId,
      user.telegramUserId,
    );

    if (
      !category ||
      category.type !== "monthly" ||
      category.status !== "active"
    ) {
      user.defaultCategoryId = null;
      await user.save();

      await bot.sendMessage(msg.chat.id, NOT_DEFAULT_CATEGORY_ERROR, {
        parse_mode: "HTML",
      });
      return;
    }

    await applyAmount(category, amount);

    const categories = await getActiveCategories(user.telegramUserId);

    await bot.sendMessage(msg.chat.id, formatCategoryDetails(category, false), {
      ...categoryKeyboardOptions(categories, user),
    });

    return;
  }

  await bot.sendMessage(msg.chat.id, "Unknown input.");
}

export async function handleCallback(
  bot: TelegramBot,
  query: CallbackQuery,
  user: UserDocument,
): Promise<void> {
  const data = query.data;
  if (!data || !query.message || !("chat" in query.message)) {
    return;
  }
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  if (data.startsWith("cat_type:")) {
    const type = data.split(":")[1] as CategoryType;

    user.state = {
      step: STEPS.CATEGORY_TYPE_CONFIRMATION,
      payload: {
        ...user.state.payload,
        type,
      },
    };
    await user.save();

    const opposite = type === "annual" ? "monthly" : "annual";

    await bot.editMessageReplyMarkup(
      {inline_keyboard: []},
      {chat_id: chatId, message_id: messageId},
    );

    const payloadName = String(
      (user.state.payload as {name?: string}).name ?? "",
    );

    await bot.sendMessage(
      chatId,
      CATEGORY_CONFIRMATION_MESSAGE(type, payloadName),
      {
        reply_markup: {
          inline_keyboard: [
            [{text: "✅ Confirm", callback_data: `confirm_cat_type:${type}`}],
            [
              {
                text: `🔄 Set as ${opposite}`,
                callback_data: `confirm_cat_type:${opposite}`,
              },
            ],
          ],
        },
      },
    );
    return;
  }

  if (data.startsWith("confirm_cat_type:")) {
    const type = data.split(":")[1] as CategoryType;

    user.state = {
      step: STEPS.CATEGORY_BUGDET_SET,
      payload: {
        ...user.state.payload,
        type,
      },
    };
    await user.save();

    await bot.editMessageText(`Type is set`, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [],
      },
    });

    const budgetPayloadName = String(
      (user.state.payload as {name?: string}).name ?? "",
    );
    await bot.sendMessage(
      chatId,
      CATEGORY_BUDGET_SET_MESSAGE(type, budgetPayloadName),
      {parse_mode: "HTML"},
    );
    return;
  }

  if (data.startsWith("default_yes:")) {
    const categoryId = data.split(":")[1];
    const category = await getCategoryById(categoryId, user.telegramUserId);

    if (
      !category ||
      category.type !== "monthly" ||
      category.status !== "active"
    ) {
      await bot.sendMessage(chatId, CATEGORY_NOT_FOUND_ERROR, {
        parse_mode: "HTML",
      });
      return;
    }

    await setDefaultCategory(user.telegramUserId, categoryId);

    user.defaultCategoryId = categoryId;
    user.state = {step: null, payload: {}};
    await user.save();

    const categories = await getActiveCategories(user.telegramUserId);

    await bot.sendMessage(chatId, DEFAULT_CATEGORY_SET_MESSAGE(category.name), {
      parse_mode: "HTML",
      ...categoryKeyboardOptions(categories, user),
    });

    await bot.editMessageReplyMarkup(
      {inline_keyboard: []},
      {
        chat_id: chatId,
        message_id: messageId,
      },
    );

    return;
  }

  if (data.startsWith("default_no:")) {
    user.state = {step: null, payload: {}};
    await user.save();

    const categories = await getActiveCategories(user.telegramUserId);

    await bot.sendMessage(
      chatId,
      "👍",
      categoryKeyboardOptions(categories, user),
    );

    await bot.editMessageReplyMarkup(
      {inline_keyboard: []},
      {
        chat_id: chatId,
        message_id: messageId,
      },
    );

    return;
  }

  if (data.startsWith("history:")) {
    const categoryId = data.split(":")[1];
    const category = await getCategoryById(categoryId, user.telegramUserId);

    if (!category || category.status !== "active") {
      await bot.sendMessage(chatId, CATEGORY_NOT_FOUND_ERROR, {
        parse_mode: "HTML",
      });
      return;
    }

    const text =
      category.type === "monthly"
        ? formatMonthlyHistory(category)
        : formatAnnualHistory(category);

    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [{text: "⬅️ Back", callback_data: `open_category:${category._id}`}],
        ],
      },
    });
    return;
  }

  if (data.startsWith("open_category:")) {
    const categoryId = data.split(":")[1];
    const category = await getCategoryById(categoryId, user.telegramUserId);

    if (!category || category.status !== "active") {
      await bot.sendMessage(chatId, CATEGORY_NOT_FOUND_ERROR, {
        parse_mode: "HTML",
      });
      return;
    }

    user.state = {
      step: STEPS.CATEGORY_AMOUNT,
      payload: {categoryId},
    };
    await user.save();

    await bot.editMessageText(formatCategoryDetails(category), {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: categoryActionsKeyboard(category),
    });
    return;
  }

  if (data.startsWith("edit:")) {
    const categoryId = data.split(":")[1];
    const category = await getCategoryById(categoryId, user.telegramUserId);

    if (!category || category.status !== "active") {
      await bot.sendMessage(chatId, CATEGORY_NOT_FOUND_ERROR, {
        parse_mode: "HTML",
      });
      return;
    }

    const isDefault = Boolean(
      user.defaultCategoryId &&
      String(user.defaultCategoryId) === String(category._id),
    );

    await bot.editMessageText(`Edit "${category.name}"`, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: editCategoryKeyboard(category, isDefault),
    });
    return;
  }

  if (data.startsWith("edit_rename:")) {
    const categoryId = data.split(":")[1];

    user.state = {step: STEPS.RENAME, payload: {categoryId}};
    await user.save();

    await bot.editMessageText(SEND_CATEGORY_NAME_MESSAGE, {
      chat_id: chatId,
      message_id: messageId,
    });
    return;
  }

  if (data.startsWith("edit_budget:")) {
    const categoryId = data.split(":")[1];

    user.state = {step: STEPS.BUDGET_UPDATE, payload: {categoryId}};
    await user.save();

    await bot.editMessageText(SEND_NEW_BUDGET_MESSAGE, {
      chat_id: chatId,
      message_id: messageId,
    });
    return;
  }

  if (data.startsWith("edit_reset:")) {
    const categoryId = data.split(":")[1];
    const category = await getCategoryById(categoryId, user.telegramUserId);

    if (!category || category.status !== "active") {
      await bot.sendMessage(chatId, CATEGORY_NOT_FOUND_ERROR, {
        parse_mode: "HTML",
      });
      return;
    }

    await resetCategorySpend(category);

    const categories = await getActiveCategories(user.telegramUserId);

    await bot.editMessageText(BUDGET_RESET_MESSAGE(category.name), {
      chat_id: chatId,
      message_id: messageId,
    });

    await bot.sendMessage(
      chatId,
      "💰",
      categoryKeyboardOptions(categories, user),
    );
    return;
  }

  if (data.startsWith("edit_convert_to_monthly:")) {
    const categoryId = data.split(":")[1];
    const category = await getCategoryById(categoryId, user.telegramUserId);

    if (
      !category ||
      category.status !== "active" ||
      category.type !== "annual"
    ) {
      await bot.sendMessage(chatId, CATEGORY_TYPE_CONVERT_ERROR, {
        parse_mode: "HTML",
      });
      return;
    }

    await convertAnnualToMonthly(category);

    const categories = await getActiveCategories(user.telegramUserId);

    await bot.editMessageText(
      CATEGORY_CONVERTED_TO_MONTHLY_MESSAGE(category.name),
      {
        chat_id: chatId,
        message_id: messageId,
      },
    );

    await bot.sendMessage(
      chatId,
      "💰",
      categoryKeyboardOptions(categories, user),
    );
    return;
  }

  if (data.startsWith("edit_convert_to_annual:")) {
    const categoryId = data.split(":")[1];
    const category = await getCategoryById(categoryId, user.telegramUserId);

    if (
      !category ||
      category.status !== "active" ||
      category.type !== "monthly"
    ) {
      await bot.sendMessage(chatId, CATEGORY_TYPE_CONVERT_ERROR, {
        parse_mode: "HTML",
      });
      return;
    }

    // If this was the default category, clear it — annual can't be default
    if (
      user.defaultCategoryId &&
      String(user.defaultCategoryId) === String(category._id)
    ) {
      await clearDefaultCategory(user.telegramUserId);
      user.defaultCategoryId = null;
      await user.save();
    }

    await convertAnnualToMonthly(category);

    const categories = await getActiveCategories(user.telegramUserId);

    await bot.editMessageText(
      CATEGORY_CONVERTED_TO_ANNUAL_MESSAGE(category.name),
      {chat_id: chatId, message_id: messageId},
    );

    await bot.sendMessage(
      chatId,
      "💰",
      categoryKeyboardOptions(categories, user),
    );
    return;
  }

  if (data.startsWith("set_default:")) {
    const categoryId = data.split(":")[1];
    const category = await getCategoryById(categoryId, user.telegramUserId);

    if (
      !category ||
      category.status !== "active" ||
      category.type !== "monthly"
    ) {
      await bot.sendMessage(chatId, SET_DEFAULT_ERROR, {parse_mode: "HTML"});
      return;
    }

    await setDefaultCategory(user.telegramUserId, categoryId);

    user.defaultCategoryId = categoryId;
    await user.save();

    const categories = await getActiveCategories(user.telegramUserId);

    await bot.editMessageText(DEFAULT_CATEGORY_SET_MESSAGE(category.name), {
      chat_id: chatId,
      message_id: messageId,
    });

    await bot.sendMessage(
      chatId,
      "💰",
      categoryKeyboardOptions(categories, user),
    );
    return;
  }

  if (data.startsWith("unset_default:")) {
    await clearDefaultCategory(user.telegramUserId);

    user.defaultCategoryId = null;
    await user.save();

    const categories = await getActiveCategories(user.telegramUserId);

    await bot.editMessageText(DEFAULT_CATEGORY_REMOVED, {
      chat_id: chatId,
      message_id: messageId,
    });

    await bot.sendMessage(
      chatId,
      "💰",
      categoryKeyboardOptions(categories, user),
    );
    return;
  }

  if (data.startsWith("remove:")) {
    const categoryId = data.split(":")[1];
    const category = await getCategoryById(categoryId, user.telegramUserId);

    if (!category || category.status !== "active") {
      await bot.sendMessage(chatId, CATEGORY_NOT_FOUND_ERROR, {
        parse_mode: "HTML",
      });
      return;
    }

    await bot.editMessageText(formatRemovePrompt(category), {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: confirmRemoveKeyboard(String(category._id)),
    });
    return;
  }

  if (data.startsWith("confirm_remove:")) {
    const categoryId = data.split(":")[1];
    const category = await getCategoryById(categoryId, user.telegramUserId);

    if (!category || category.status !== "active") {
      await bot.sendMessage(chatId, CATEGORY_NOT_FOUND_ERROR, {
        parse_mode: "HTML",
      });
      return;
    }

    await archiveCategory(category);

    if (
      user.defaultCategoryId &&
      String(user.defaultCategoryId) === String(category._id)
    ) {
      await clearDefaultCategory(user.telegramUserId);
      user.defaultCategoryId = null;
      await user.save();
    }

    const categories = await getActiveCategories(user.telegramUserId);

    await resetUser(user);

    await bot.sendMessage(
      chatId,
      CATEGORY_REMOVED(category.name),
      categoryKeyboardOptions(categories, user),
    );
    return;
  }

  await bot.sendMessage(chatId, "Unknown action", {parse_mode: "HTML"});
}
