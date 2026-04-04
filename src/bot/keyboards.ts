import type { KeyboardButton, ReplyKeyboardMarkup } from 'node-telegram-bot-api';
import { ADD_NEW_CATEGORY_MESSAGE } from './constants.js';
import { ICategory, IUser } from '../types.js';

export function getCategoryButtonLabel(category: ICategory, user: IUser): string {
  const spent = formatAmount(category.currentSpent || 0);
  const budget = formatAmount(category.currentBudget || 0);
  const type = category.type;

  const isDefault =
    user?.defaultCategoryId &&
    String(user.defaultCategoryId) === String(category._id);

  return `${category.name} ${spent}/${budget}${isDefault ? ' ⭐' : ''} (${type})`;
}

export function categoriesReplyKeyboard(
  categories: ICategory[],
  user: IUser
): ReplyKeyboardMarkup {
  // 1. Sort:
  // - Monthly first
  // - Higher budget first
  const sorted = [...categories].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'monthly' ? -1 : 1;
    }
    return (b.currentBudget ?? 0) - (a.currentBudget ?? 0);
  });

  // 2. Split groups
  const monthly = sorted.filter(c => c.type === 'monthly');
  const annual = sorted.filter(c => c.type === 'annual');

  // 3. Build rows
  const rows: KeyboardButton[][] = [];

  if (monthly.length) {
    monthly.forEach(c => {
      rows.push([{ text: getCategoryButtonLabel(c, user) }]);
    });
  }

  if (annual.length) {
    annual.forEach(c => {
      rows.push([{ text: getCategoryButtonLabel(c, user) }]);
    });
  }

  // 4. Add "Add category" button LAST
  if (categories.length < 8) {
    rows.push([{ text: ADD_NEW_CATEGORY_MESSAGE }]);
  }

  return {
    keyboard: rows,
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

export function categoryActionsKeyboard(category: ICategory) {
  return {
    inline_keyboard: [
      [
        { text: 'History', callback_data: `history:${String(category._id)}` },
        { text: 'Edit', callback_data: `edit:${String(category._id)}` },
        { text: 'Remove', callback_data: `remove:${String(category._id)}` },
      ],
    ],
  };
}

export function confirmCategoryTypeKeyboard(selectedType: 'annual' | 'monthly') {
  const opposite = selectedType === 'annual' ? 'monthly' : 'annual';

  return {
    inline_keyboard: [
      [{ text: 'Confirm', callback_data: `confirm_cat_type:${selectedType}` }],
      [{ text: `Set as ${capitalize(opposite)}`, callback_data: `cat_type:${opposite}` }],
    ],
  };
}

export function defaultChoiceKeyboard(categoryId: string) {
  return {
    inline_keyboard: [
      [
        { text: 'Yes', callback_data: `default_yes:${categoryId}` },
        { text: 'No', callback_data: `default_no:${categoryId}` },
      ],
    ],
  };
}

export function editCategoryKeyboard(category: ICategory, isDefault: boolean) {
  const rows: { text: string; callback_data: string }[][] = [
    [{ text: 'Rename', callback_data: `edit_rename:${String(category._id)}` }],
    [{ text: 'Update budget', callback_data: `edit_budget:${String(category._id)}` }],
    [{ text: 'Reset spend to 0', callback_data: `edit_reset:${String(category._id)}` }],
  ];

  if (category.type === 'annual') {
    rows.push([
      {
        text: 'Convert to Monthly',
        callback_data: `edit_convert_to_monthly:${String(category._id)}`,
      },
    ]);
  }

  if (category.type === 'monthly') {
    rows.push([
      {
        text: isDefault ? 'Unset default ⭐' : 'Set as default ⭐',
        callback_data: isDefault
          ? `unset_default:${String(category._id)}`
          : `set_default:${String(category._id)}`,
      },
    ]);
  }

  rows.push([{ text: '⬅️ Back', callback_data: `open_category:${String(category._id)}` }]);

  return {
    inline_keyboard: rows,
  };
}

export function confirmRemoveKeyboard(categoryId: string) {
  return {
    inline_keyboard: [
      [
        { text: 'Yes, remove', callback_data: `confirm_remove:${categoryId}` },
        { text: 'Cancel', callback_data: `open_category:${categoryId}` },
      ],
    ],
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatAmount(value: number): string {
  const num = Number(value || 0);
  return Number.isInteger(num) ? String(num) : num.toFixed(2);
}
