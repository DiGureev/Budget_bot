// ====================
// ONBOARDING
// ====================

import {CategoryType} from "../types.js";

export const WELCOME_MESSAGE = `<b>Welcome to the Spending Mirror Bot!</b>\n\nOur goal is to help you manage your monthly and annual spending. Please enter your <b>email</b> to create an account.`;

export const ACCOUNT_CREATED_MESSAGE = `Account created 🎉\n\nNext step: create categories you want to track using "➕ Add new category" button below. You can add up to 8 categories. 🚀`;

export const EMAIL_VALIDATION_ERROR = "Please enter a valid email address.";
export const EMAIL_SAVE_ERROR = "Could not save your email. Please try again.";
export const BOT_STARTED_MESSAGE = "The bot has started.";

// ====================
// CATEGORY CREATION
// ====================

export const ADD_NEW_CATEGORY_MESSAGE = "➕ Add new category";

export const CREATE_CATEGORY_WARNING =
  "Please create categories to track your spending first.";

export const CATEGORIES_LIMIT_REACHED_ERROR = "You can add up to 8 categories.";

export const ENTER_CATEGORY_NAME_MESSAGE =
  "Enter a name for your new category. You can include emojis. You will be able to edit it later.";

export const CATEGORY_NAME_EXISTS_ERROR =
  "A category with this name already exists. Please choose another name.";

export const CREATE_CATEGORY_ERROR =
  "Could not create the category. Please try again.";

export const CATEGORY_TYPE_CHOICE_MESSAGE = `Is this an annual or a monthly category?\n\nIf it's <b>monthly</b>, we track spending within the month and reset it on the 1st.\n\nIf it's <b>annual</b>, we track spending across the entire year.`;

export const CATEGORY_CONFIRMATION_MESSAGE = (
  type: CategoryType,
  categoryName: string,
) => `You chose the ${type} type for "${categoryName}". Confirm?`;

export const CATEGORY_CONFIRM_WARNING =
  "Please choose Yes or No using the buttons below.";

export const CATEGORY_TYPE_WARNING =
  "Please confirm the category type using the buttons above.";

export const CATEGORY_BUDGET_SET_MESSAGE = (
  type: CategoryType,
  categoryName: string,
) =>
  `What budget would you like to set for the ${type} category "${categoryName}"?`;

export const CATEGORY_BUDGET_VALIDATION_ERROR =
  "Please enter a valid positive budget.";

// ====================
// CATEGORY SUCCESS / DEFAULT
// ====================

export const CATEGORY_CREATED_MESSAGE = (
  categoryName: string,
  amount: string,
  type: CategoryType = "monthly",
): string => {
  const typeText = type === "monthly" ? "monthly" : "annual";
  return `"${categoryName}" created with a ${typeText} budget of ${amount} shekels.`;
};

export const MAKE_DEFAULT_CATEGORY_MESSAGE = (
  categoryName: string,
  amount: string,
): string =>
  `${CATEGORY_CREATED_MESSAGE(categoryName, amount)}\n\nWould you like to set "${categoryName}" as the <b>default</b> category?\n\nIf set, you can simply send an amount (e.g. 200) and it will be added automatically.\n\nUseful for your most frequent category. You can change it later.`;

export const DEFAULT_CATEGORY_SET_MESSAGE = (categoryName: string): string =>
  `Category "${categoryName}" is now set as default ⭐. You can now send amounts without selecting a category.`;

export const DEFAULT_CATEGORY_REMOVED = "Default category removed.";

export const SET_DEFAULT_ERROR =
  "Only monthly categories can be set as default.";

// ====================
// CATEGORY MANAGEMENT
// ====================

export const SEND_CATEGORY_NAME_MESSAGE = "Send the new category name.";

export const SEND_NEW_BUDGET_MESSAGE = "Send the new budget.";

export const CATEGORY_REMOVED = (categoryName: string) =>
  `"${categoryName}" was removed.`;

export const CATEGORY_NOT_FOUND_ERROR = "Category not found.";

export const CATEGORY_TYPE_CONVERT_ERROR = "This category cannot be converted.";

export const CATEGORY_CONVERTED_TO_MONTHLY_MESSAGE = (categoryName: string) =>
  `"${categoryName}" was converted to monthly.`;

export const CATEGORY_CONVERTED_TO_ANNUAL_MESSAGE = (categoryName: string) =>
  `"${categoryName}" was converted to annual.`;

export const BUDGET_RESET_MESSAGE = (categoryName: string) =>
  `Spending for "${categoryName}" was reset to 0.`;

// ====================
// AMOUNT / INPUT
// ====================

export const AMOUNT_VALIDATION_ERROR =
  "Please send a valid amount (e.g. 300, 30.10, -300 for refunds).";

export const NOT_DEFAULT_CATEGORY_ERROR =
  "No default category set. Please select a category before sending an amount.";

export const CHOOSE_CATEGORY_TYPE_MESSAGE = "Please choose a category type.";

// ====================
// HELP
// ====================

export const HELP_MESSAGE = `💸 <b>Spending Mirror Bot — Help</b>\n\nTrack your spending by categories and stay in control of your budget.\n\n<b>🧩 How it works</b>\n1. Create categories (e.g. Food, Rent, Fun)\n2. Set a budget (monthly or annual)\n3. Add expenses (300 = spending, -300 = refund)\n4. Monitor progress\n\n<b>➕ Add a category</b>\nTap <b>"Add new category"</b> → Name → Type → Budget\nOptionally set it as ⭐ default\n\n<b>💰 Add spending</b>\n- Select a category → send amount\n- OR send amount directly (if default is set)\n\n<b>✏️ Manage categories</b>\nRename, change budget, reset, view history, set default, delete\n\n<b>⚠️ Limits</b>\nUp to 8 active categories.\n\nVisit <a href="https://bluewhitefinance.com/">Blue & White Finance</a> for financial education.`;
