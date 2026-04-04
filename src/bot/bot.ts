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
  getContext,
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
): Promise<void> {
  const context = getContext(msg);

  if (!user.onboarding.emailSubmitted) {
    await bot.sendMessage(msg.chat.id, WELCOME_MESSAGE, {parse_mode: "HTML"});
    return;
  }

  await resetUser(user);

  const defaultCategoryId = await getDefaultCategoryById(user.telegramUserId);
  const categories = await getActiveCategories(context);
  const hasCategories = categories.length > 0;

  let message: string;

  if (defaultCategoryId) {
    const defaultCat = await getCategoryById(defaultCategoryId, context);
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
  const context = getContext(msg);
  const text = (msg.text || "").trim();
  let step = user.state?.step;

  if (
    user.state?.context &&
    (user.state.context.ownerId !== context.ownerId ||
      user.state.context.ownerType !== context.ownerType)
  ) {
    user.state = {step: null, context: null, payload: {}};
    await user.save();
    step = null;
  }

  const activeCategories = await getActiveCategories(context);
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
      context,
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
    const count = await countActiveCategories(context);

    if (count >= 8) {
      await bot.sendMessage(msg.chat.id, CATEGORIES_LIMIT_REACHED_ERROR, {
        parse_mode: "HTML",
        ...categoryKeyboardOptions(activeCategories, user),
      });
      return;
    }

    user.state = {step: STEPS.CATEGORY_NAME_SET, context, payload: {}};
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

    const categories = await getActiveCategories(context);

    await bot.sendMessage(msg.chat.id, ACCOUNT_CREATED_MESSAGE, {
      parse_mode: "HTML",
      ...categoryKeyboardOptions(categories, user),
    });

    return;
  }

  if (step === STEPS.CATEGORY_BUGDET_SET) {
    const result = await submitCategoryBudget(text, user, context);

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

    const categories = await getActiveCategories(context);

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
    const result = await submitCategoryAmount(text, user, context);

    if (!result.ok) {
      await bot.sendMessage(msg.chat.id, result.error, {parse_mode: "HTML"});
      return;
    }

    const categories = await getActiveCategories(context);

    await bot.sendMessage(
      msg.chat.id,
      formatCategoryDetails(result.category, false),
      {
        ...categoryKeyboardOptions(categories, user),
      },
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
      await bot.sendMessage(msg.chat.id, NOT_DEFAULT_CATEGORY_ERROR, {
        parse_mode: "HTML",
      });
      return;
    }

    await applyAmount(category, amount);

    const categories = await getActiveCategories(context);

    await bot.sendMessage(msg.chat.id, formatCategoryDetails(category, false), {
      ...categoryKeyboardOptions(categories, user),
    });

    return;
  }

  await bot.sendMessage(msg.chat.id, "Unknown input.");
}
