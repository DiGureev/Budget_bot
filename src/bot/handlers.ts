import type TelegramBot from 'node-telegram-bot-api';
import type { CallbackQuery, Message } from 'node-telegram-bot-api';
import type { ICategory } from '../models/Category.js';
import type { UserDocument } from '../models/User.js';
import { isValidEmail } from '../utils/validators.js';
import { normalizeCategoryName } from '../utils/normalize.js';
import { parseAmount } from '../services/amountParser.js';
import { submitEmailToKit } from '../services/kitService.js';
import {
  countActiveCategories,
  createCategory,
  getActiveCategories,
  getCategoryById,
  applyAmount,
  archiveCategory,
  renameCategory,
  updateCategoryBudget,
  resetCategorySpend,
  convertAnnualToMonthly,
} from '../services/categoryService.js';
import {
  setDefaultCategory,
  clearDefaultCategory,
  getDefaultCategoryById,
} from '../services/userService.js';
import {
    getCategoryButtonLabel,
    categoriesReplyKeyboard,
    categoryActionsKeyboard,
    defaultChoiceKeyboard,
    editCategoryKeyboard,
    confirmRemoveKeyboard,
  } from './keyboards.js';
import {
  formatCategoryDetails,
  formatMonthlyHistory,
  formatAnnualHistory,
  formatRemovePrompt,
  formatMoney,
} from './messages.js';
import {
  WELCOME_MESSAGE,
  ACCOUNT_CREATED_MESSAGE,
  ADD_NEW_CATEGORY_MESSAGE,
  EMAIL_VALIDATION_ERROR,
  EMAIL_SAVE_ERROR,
  BOT_STARTED_MESSAGE,
  ADD_CATEGORY_ERROR,
  ENTER_CATEGORY_NAME_MESSAGE,
  CATEGORY_NAME_EXISTS_ERROR,
  CREATE_CATEGORY_ERROR,
  CATEGORY_TYPE_CHOICE_MESSAGE,
  CATEGORY_BUDGET_VALIDATION_ERROR,
  CATEGORY_CREATED_MESSAGE,
  MAKE_DEFAULT_CATEGORY_MESSAGE,
  DEFAULT_CATEGORY_SET_MESSAGE,
  AMOUNT_VALIDATION_ERROR,
  CATEGORY_NOT_FOUND_ERROR,
  NOT_DEFAULT_CATEGORY_ERROR,
  HELP_MESSAGE
} from './constants.js';

function categoryKeyboardOptions(categories: ICategory[], user: UserDocument) {
  return {
    reply_markup: categoriesReplyKeyboard(categories, user),
  };
}

export async function handleHelp(bot: TelegramBot, msg: Message, user: UserDocument): Promise<void> {
  await bot.sendMessage(
    msg.chat.id,
    HELP_MESSAGE,
    { parse_mode: 'HTML' }
  );
}
export async function handleStart(
  bot: TelegramBot,
  msg: Message,
  user: UserDocument
): Promise<void> {
  if (!user.onboarding.emailSubmitted) {
    await bot.sendMessage(msg.chat.id, WELCOME_MESSAGE, { parse_mode: 'HTML' });
    return;
  }

  const defaultCategoryId = await getDefaultCategoryById(user.telegramUserId);
  const categories = await getActiveCategories(user.telegramUserId);
  const hasCategories = categories.length > 0;
  let message: string;
  if (defaultCategoryId) {
    const defaultCat = await getCategoryById(defaultCategoryId, user.telegramUserId);
    const displayName = defaultCat?.name ?? 'default';
    message = `${BOT_STARTED_MESSAGE} Send the amount of spendings for default category "${displayName}".`;
  } else if (hasCategories) {
    message = `${BOT_STARTED_MESSAGE} Choose the category to add the spendings.`;
  } else {
    message = `${BOT_STARTED_MESSAGE} Add categories to start tracking your spending.`;
  }

  await bot.sendMessage(msg.chat.id, message, {
    parse_mode: 'HTML',
    ...categoryKeyboardOptions(categories, user),
  });
}

export async function handleText(bot: TelegramBot, msg: Message, user: UserDocument): Promise<void> {
  const text = (msg.text || '').trim();
  const step = user.state?.step;

  const activeCategories = await getActiveCategories(user.telegramUserId);

  const hasCategories = activeCategories.length > 0;

  if (user.onboarding.completed && !hasCategories && step === null && text !== ADD_NEW_CATEGORY_MESSAGE) {
    await bot.sendMessage(
      msg.chat.id,
      'Please create categories to track your spendings first.',
      { parse_mode: 'HTML'},
    );
    return;
  }


  if (step === 'awaiting_email') {
    const email = text.trim();

    if (!isValidEmail(email)) {
      await bot.sendMessage(msg.chat.id, EMAIL_VALIDATION_ERROR);
      return;
    }

    const result = await submitEmailToKit(email, user);

    if (!result.ok) {
      await bot.sendMessage(
        msg.chat.id,
        EMAIL_SAVE_ERROR
      );
      return;
    }

    user.onboarding.emailSubmitted = true;
    user.onboarding.completed = true;
    user.state = { step: null, payload: {} };
    await user.save();

    const categories = await getActiveCategories(user.telegramUserId);

    await bot.sendMessage(
      msg.chat.id,
      ACCOUNT_CREATED_MESSAGE, 
      { parse_mode: 'HTML', ...categoryKeyboardOptions(categories, user) }
    );
    return;
  }

  if (step === 'awaiting_default_category_confirm') {
    await bot.sendMessage(
      msg.chat.id,
      'Please choose Yes or No using the buttons below.'
    );
    return;
  }

  if (text === ADD_NEW_CATEGORY_MESSAGE) {
    const count = await countActiveCategories(user.telegramUserId);

    if (count >= 8) {
      await bot.sendMessage(
        msg.chat.id,
        ADD_CATEGORY_ERROR,
        { parse_mode: 'HTML', ...categoryKeyboardOptions(activeCategories, user) },

      );
      return;
    }

    user.state = { step: 'awaiting_category_name', payload: {} };
    await user.save();

    await bot.sendMessage(
      msg.chat.id,
      ENTER_CATEGORY_NAME_MESSAGE,
      {
        parse_mode: 'HTML',
        reply_markup: {
          remove_keyboard: true,
        },
      }
    );
    return;
  }

  const selectedCategory = activeCategories.find(
    (category) => text === getCategoryButtonLabel(category, user)
  );
  
  if (selectedCategory) {
    user.state = {
      step: 'awaiting_category_amount',
      payload: { categoryId: String(selectedCategory._id) },
    };
    await user.save();
  
    await bot.sendMessage(
      msg.chat.id,
      formatCategoryDetails(selectedCategory),
      {
        reply_markup: categoryActionsKeyboard(selectedCategory),
      }
    );
    return;
  }

  if (step === 'awaiting_category_name') {
    const count = await countActiveCategories(user.telegramUserId);
  
    if (count >= 8) {
      user.state = { step: null, payload: {} };
      await user.save();
  
      const categories = await getActiveCategories(user.telegramUserId);
  
      await bot.sendMessage(
        msg.chat.id,
        ADD_CATEGORY_ERROR,
        { parse_mode: 'HTML', ...categoryKeyboardOptions(categories, user) },
        
      );
      return;
    }
  
    const normalizedName = normalizeCategoryName(text);
  
    const existing = activeCategories.some(
      (category) => category.name === normalizedName
    );
  
    if (existing) {
      await bot.sendMessage(
        msg.chat.id,
        CATEGORY_NAME_EXISTS_ERROR,
        { parse_mode: 'HTML' },
      );
      return;
    }
  
    user.state = {
      step: 'awaiting_category_type_choice',
      payload: {
        name: normalizedName,
      },
    };
    await user.save();
  
    await bot.sendMessage(
      msg.chat.id,
      CATEGORY_TYPE_CHOICE_MESSAGE,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🗓️ Annual', callback_data: 'cat_type:annual' },
              { text: '🌕 Monthly', callback_data: 'cat_type:monthly' },
            ],
          ],
          remove_keyboard: true,
        },
      }
    );
    return;
  }

  if (step === 'awaiting_category_budget') {
    const amount = parseAmount(text);
  
    if (amount === null || amount < 0) {
      await bot.sendMessage(
        msg.chat.id,
        CATEGORY_BUDGET_VALIDATION_ERROR,
        { parse_mode: 'HTML' },
      );
      return;
    }
  
    const { name, type } = user.state.payload as {
      name: string;
      type: 'monthly' | 'annual';
    };

    try {
      const category = await createCategory({
        userId: user.telegramUserId,
        name,
        type,
        budget: amount,
      });

      if (type === 'monthly') {
        user.state = {
          step: 'awaiting_default_category_confirm',
          payload: { categoryId: String(category._id) },
        };
        await user.save();

        await bot.sendMessage(msg.chat.id, MAKE_DEFAULT_CATEGORY_MESSAGE(category.name, formatMoney(amount)), {
          parse_mode: 'HTML',
          reply_markup: defaultChoiceKeyboard(String(category._id)),
        });
        return;
      }
  
      user.state = { step: null, payload: {} };
      await user.save();
  
      const categories = await getActiveCategories(user.telegramUserId);
  
      await bot.sendMessage(
        msg.chat.id,
        CATEGORY_CREATED_MESSAGE(category.name, formatMoney(amount), 'annual'),
        { parse_mode: 'HTML', ...categoryKeyboardOptions(categories, user) },
      );
      return;
    } catch {
      await bot.sendMessage(msg.chat.id, CREATE_CATEGORY_ERROR, { parse_mode: 'HTML' });
      return;
    }
  }

  if (step === 'awaiting_category_amount') {
    const amount = parseAmount(text);

    if (amount === null) {
      await bot.sendMessage(
        msg.chat.id,
        AMOUNT_VALIDATION_ERROR,
        { parse_mode: 'HTML' },
      );
      return;
    }

    const categoryId = String(
      (user.state.payload as { categoryId?: string }).categoryId ?? ''
    );
    const category = await getCategoryById(categoryId, user.telegramUserId);

    if (!category || category.status !== 'active') {
      await bot.sendMessage(msg.chat.id, CATEGORY_NOT_FOUND_ERROR, { parse_mode: 'HTML' });
      return;
    }

    await applyAmount(category, amount);

    const categories = await getActiveCategories(user.telegramUserId);

    await bot.sendMessage(
      msg.chat.id,
      formatCategoryDetails(category),
      {
        ...categoryKeyboardOptions(categories, user)
      }
    );
    return;
  }

  if (step === 'awaiting_rename') {
    const categoryId = String(
      (user.state.payload as { categoryId?: string }).categoryId ?? ''
    );
    const category = await getCategoryById(categoryId, user.telegramUserId);

    if (!category || category.status !== 'active') {
      await bot.sendMessage(msg.chat.id, CATEGORY_NOT_FOUND_ERROR, { parse_mode: 'HTML' });
      return;
    }

    const normalizedName = normalizeCategoryName(text);

    try {
      await renameCategory(category, normalizedName);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'CATEGORY_EXISTS') {
        await bot.sendMessage(
          msg.chat.id,
          CATEGORY_NAME_EXISTS_ERROR,
          { parse_mode: 'HTML' },
        );
        return;
      }
      throw err;
    }

    user.state = { step: null, payload: {} };
    await user.save();

    const categories = await getActiveCategories(user.telegramUserId);

    await bot.sendMessage(
      msg.chat.id,
      `Category renamed to "${normalizedName}".`,
      categoryKeyboardOptions(categories, user)
    );
    return;
  }

  if (step === 'awaiting_budget_update') {
    const amount = parseAmount(text);

    if (amount === null || amount < 0) {
      await bot.sendMessage(
        msg.chat.id,
        CATEGORY_BUDGET_VALIDATION_ERROR,
        { parse_mode: 'HTML' },
      );
      return;
    }

    const budgetCategoryId = String(
      (user.state.payload as { categoryId?: string }).categoryId ?? ''
    );
    const category = await getCategoryById(budgetCategoryId, user.telegramUserId);

    if (!category || category.status !== 'active') {
      await bot.sendMessage(msg.chat.id, CATEGORY_NOT_FOUND_ERROR, { parse_mode: 'HTML' });
      return;
    }

    await updateCategoryBudget(category, amount);

    user.state = { step: null, payload: {} };
    await user.save();

    await bot.sendMessage(
      msg.chat.id,
      `Budget updated to ${formatMoney(amount)}.`,
      {
        reply_markup: categoryActionsKeyboard(category),
      }
    );
    return;
  }

  const amount = parseAmount(text);

  if (amount !== null) {
    if (!user.defaultCategoryId) {
      await bot.sendMessage(
        msg.chat.id,
        NOT_DEFAULT_CATEGORY_ERROR,
        { parse_mode: 'HTML' },
      );
      return;
    }

    const category = await getCategoryById(
      user.defaultCategoryId,
      user.telegramUserId
    );

    if (!category || category.type !== 'monthly' || category.status !== 'active') {
      user.defaultCategoryId = null;
      await user.save();

      await bot.sendMessage(
        msg.chat.id,
        NOT_DEFAULT_CATEGORY_ERROR,
        { parse_mode: 'HTML' },
      );
      return;
    }

    await applyAmount(category, amount);

    const categories = await getActiveCategories(user.telegramUserId);

    await bot.sendMessage(
      msg.chat.id,
      formatCategoryDetails(category),
      {
        ...categoryKeyboardOptions(categories, user)
      }
    );
    return;
  } else {
    if (step === "awaiting_category_type_choice"){
      await bot.sendMessage(msg.chat.id, 'Please choose a type for new category');
      return;
    }
  }
  console.log(step);
  console.log(text);
  console.log(amount)

  await bot.sendMessage(msg.chat.id, 'Unknown input.');
}

export async function handleCallback(
  bot: TelegramBot,
  query: CallbackQuery,
  user: UserDocument
): Promise<void> {
  const data = query.data;
  if (!data || !query.message || !('chat' in query.message)) {
    return;
  }
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  if (data.startsWith('cat_type:')) {
    const type = data.split(':')[1];
  
    user.state = {
      step: 'awaiting_category_type_confirmation',
      payload: {
        ...user.state.payload,
        type,
      },
    };
    await user.save();
  
    const opposite = type === 'annual' ? 'monthly' : 'annual';
  
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: chatId, message_id: messageId }
    );

    const payloadName = String(
      (user.state.payload as { name?: string }).name ?? ''
    );
    await bot.sendMessage(
      chatId,
      `You chose ${type} category for "${payloadName}". Confirm?`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Confirm', callback_data: `confirm_cat_type:${type}` }],
            [{ text: `🔄 Set as ${opposite}`, callback_data: `confirm_cat_type:${opposite}` }],
          ],
        },
      }
    );
    return;
  }

  if (data.startsWith('confirm_cat_type:')) {
    const type = data.split(':')[1];

    user.state = {
      step: 'awaiting_category_budget',
      payload: {
        ...user.state.payload,
        type,
      },
    };
    await user.save();

    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: chatId, message_id: messageId }
    );

    const budgetPayloadName = String(
      (user.state.payload as { name?: string }).name ?? ''
    );
    await bot.sendMessage(
      chatId,
      `Great. Now set a budget for ${type === 'monthly' ? 'a monthly' : 'an annual'} "${budgetPayloadName}" category.`,
      { parse_mode: 'HTML' },
    );
    return;
  }

  if (data.startsWith('default_yes:')) {
    const categoryId = data.split(':')[1];
    const category = await getCategoryById(categoryId, user.telegramUserId);
  
    if (!category || category.type !== 'monthly' || category.status !== 'active') {
      await bot.answerCallbackQuery(query.id, { text: CATEGORY_NOT_FOUND_ERROR });
      return;
    }
  
    await setDefaultCategory(user.telegramUserId, categoryId);
  
    user.defaultCategoryId = categoryId;
    user.state = { step: null, payload: {} };
    await user.save();
  
    const categories = await getActiveCategories(user.telegramUserId);
  
    await bot.sendMessage(
      chatId,
      DEFAULT_CATEGORY_SET_MESSAGE(category.name),
      { parse_mode: 'HTML', ...categoryKeyboardOptions(categories, user) },
    );
  
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      {
        chat_id: chatId,
        message_id: messageId,
      }
    );
  
    return;
  }
  
  if (data.startsWith('default_no:')) {
    user.state = { step: null, payload: {} };
    await user.save();
  
    const categories = await getActiveCategories(user.telegramUserId);
  
    await bot.sendMessage(
      chatId,
      ' ',
      categoryKeyboardOptions(categories, user)
    );
  
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      {
        chat_id: chatId,
        message_id: messageId,
      }
    );
  
    return;
  }

  if (data.startsWith('history:')) {
    const categoryId = data.split(':')[1];
    const category = await getCategoryById(categoryId, user.telegramUserId);

    if (!category || category.status !== 'active') {
      await bot.answerCallbackQuery(query.id, { text: CATEGORY_NOT_FOUND_ERROR });
      return;
    }

    const text =
      category.type === 'monthly'
        ? formatMonthlyHistory(category)
        : formatAnnualHistory(category);

    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [{ text: '⬅️ Back', callback_data: `open_category:${category._id}` }],
        ],
      },
    });
    return;
  }

  if (data.startsWith('open_category:')) {
    const categoryId = data.split(':')[1];
    const category = await getCategoryById(categoryId, user.telegramUserId);

    if (!category || category.status !== 'active') {
      await bot.answerCallbackQuery(query.id, { text: CATEGORY_NOT_FOUND_ERROR });
      return;
    }

    user.state = {
      step: 'awaiting_category_amount',
      payload: { categoryId },
    };
    await user.save();

    await bot.editMessageText(formatCategoryDetails(category), {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: categoryActionsKeyboard(category),
    });
    return;
  }

  if (data.startsWith('edit:')) {
    const categoryId = data.split(':')[1];
    const category = await getCategoryById(categoryId, user.telegramUserId);

    if (!category || category.status !== 'active') {
      await bot.answerCallbackQuery(query.id, { text: CATEGORY_NOT_FOUND_ERROR });
      return;
    }

    const isDefault = Boolean(
      user.defaultCategoryId &&
        String(user.defaultCategoryId) === String(category._id)
    );

    await bot.editMessageText(`Edit "${category.name}"`, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: editCategoryKeyboard(category, isDefault),
    });
    return;
  }

  if (data.startsWith('edit_rename:')) {
    const categoryId = data.split(':')[1];

    user.state = { step: 'awaiting_rename', payload: { categoryId } };
    await user.save();

    await bot.editMessageText('Send the new category name.', {
      chat_id: chatId,
      message_id: messageId,
    });
    return;
  }

  if (data.startsWith('edit_budget:')) {
    const categoryId = data.split(':')[1];

    user.state = { step: 'awaiting_budget_update', payload: { categoryId } };
    await user.save();

    await bot.editMessageText('Send the new budget.', {
      chat_id: chatId,
      message_id: messageId,
    });
    return;
  }

  if (data.startsWith('edit_reset:')) {
    const categoryId = data.split(':')[1];
    const category = await getCategoryById(categoryId, user.telegramUserId);

    if (!category || category.status !== 'active') {
      await bot.answerCallbackQuery(query.id, { text: CATEGORY_NOT_FOUND_ERROR });
      return;
    }

    await resetCategorySpend(category);

    const categories = await getActiveCategories(user.telegramUserId);

    await bot.editMessageText(
      `Spend for "${category.name}" reset to 0.`,
      {
        chat_id: chatId,
        message_id: messageId,
      }
    );

    await bot.sendMessage(
      chatId,
      'Updated.',
      categoryKeyboardOptions(categories, user)
    );
    return;
  }

  if (data.startsWith('edit_convert_to_monthly:')) {
    const categoryId = data.split(':')[1];
    const category = await getCategoryById(categoryId, user.telegramUserId);

    if (!category || category.status !== 'active' || category.type !== 'annual') {
      await bot.answerCallbackQuery(query.id, {
        text: 'Category cannot be converted.',
      });
      return;
    }

    await convertAnnualToMonthly(category);

    const categories = await getActiveCategories(user.telegramUserId);

    await bot.editMessageText(
      `"${category.name}" was converted to monthly.`,
      {
        chat_id: chatId,
        message_id: messageId,
      }
    );

    await bot.sendMessage(
      chatId,
      'Updated.',
      categoryKeyboardOptions(categories, user)
    );
    return;
  }

  if (data.startsWith('set_default:')) {
    const categoryId = data.split(':')[1];
    const category = await getCategoryById(categoryId, user.telegramUserId);

    if (!category || category.status !== 'active' || category.type !== 'monthly') {
      await bot.answerCallbackQuery(query.id, {
        text: 'Only monthly categories can be default.',
      });
      return;
    }

    await setDefaultCategory(user.telegramUserId, categoryId);

    user.defaultCategoryId = categoryId;
    await user.save();

    const categories = await getActiveCategories(user.telegramUserId);

    await bot.editMessageText(`"${category.name}" set as default ⭐.`, {
      chat_id: chatId,
      message_id: messageId,
    });

    await bot.sendMessage(
      chatId,
      'Updated.',
      categoryKeyboardOptions(categories, user)
    );
    return;
  }

  if (data.startsWith('unset_default:')) {
    await clearDefaultCategory(user.telegramUserId);

    user.defaultCategoryId = null;
    await user.save();

    const categories = await getActiveCategories(user.telegramUserId);

    await bot.editMessageText('Default category removed.', {
      chat_id: chatId,
      message_id: messageId,
    });

    await bot.sendMessage(
      chatId,
      'Updated.',
      categoryKeyboardOptions(categories, user)
    );
    return;
  }

  if (data.startsWith('remove:')) {
    const categoryId = data.split(':')[1];
    const category = await getCategoryById(categoryId, user.telegramUserId);

    if (!category || category.status !== 'active') {
      await bot.answerCallbackQuery(query.id, { text: CATEGORY_NOT_FOUND_ERROR });
      return;
    }

    await bot.editMessageText(formatRemovePrompt(category), {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: confirmRemoveKeyboard(String(category._id)),
    });
    return;
  }

  if (data.startsWith('confirm_remove:')) {
    const categoryId = data.split(':')[1];
    const category = await getCategoryById(categoryId, user.telegramUserId);

    if (!category || category.status !== 'active') {
      await bot.answerCallbackQuery(query.id, { text: CATEGORY_NOT_FOUND_ERROR });
      return;
    }

    await archiveCategory(category);

    if (user.defaultCategoryId && String(user.defaultCategoryId) === String(category._id)) {
      await clearDefaultCategory(user.telegramUserId);
      user.defaultCategoryId = null;
      await user.save();
    }
    
    const categories = await getActiveCategories(user.telegramUserId);

    console.log(categories);

    await bot.sendMessage(
      chatId,
      `"${category.name}" was removed from the menu.`,
      categoryKeyboardOptions(categories, user)
    );
    return;
  }

  await bot.answerCallbackQuery(query.id, { text: 'Unknown action' });
}