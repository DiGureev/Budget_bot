import {Message} from "node-telegram-bot-api";
import {ensureDailyBackup} from "../../services/backupService.js";
import {ensureUserPeriodsCurrent} from "../../services/rolloverService.js";
import {getOrCreateUser} from "../../services/userService.js";
import {CategoryType, ICategory, type UserDocument} from "../../types.js";
import {isValidEmail} from "../../utils/validators.js";
import {submitEmailToKit} from "../kitService.js";
import {
  AMOUNT_VALIDATION_ERROR,
  CATEGORIES_LIMIT_REACHED_ERROR,
  CATEGORY_BUDGET_VALIDATION_ERROR,
  CATEGORY_NAME_EXISTS_ERROR,
  CATEGORY_NOT_FOUND_ERROR,
  CREATE_CATEGORY_ERROR,
  EMAIL_SAVE_ERROR,
  EMAIL_VALIDATION_ERROR,
} from "../../bot/constants.js";
import {
  applyAmount,
  countActiveCategories,
  createCategory,
  getCategoryById,
  renameCategory,
  updateCategoryBudget,
} from "../categoryService.js";
import {normalizeCategoryName} from "../../utils/normalize.js";
import {parseAmount} from "../amountParser.js";

export const setUpUserAndBackup = async (
  msg: Message,
): Promise<UserDocument> => {
  if (!msg.from || !msg.chat) {
    throw new Error("Invalid message");
  }

  const {user} = await getOrCreateUser(msg);
  await ensureDailyBackup();
  await ensureUserPeriodsCurrent(user.telegramUserId);
  return user;
};

export const submitEmail = async (
  email: string,
  user: UserDocument,
): Promise<{ok: boolean; error?: string}> => {
  if (!isValidEmail(email)) {
    return {ok: false, error: EMAIL_VALIDATION_ERROR};
  }

  const result = await submitEmailToKit(email, user);

  if (!result.ok) {
    return {ok: false, error: EMAIL_SAVE_ERROR};
  }

  user.onboarding.emailSubmitted = true;
  user.onboarding.completed = true;
  user.state = {step: null, payload: {}};
  await user.save();

  return {ok: true};
};

type CategoryNameResult =
  | {ok: true; normalizedName: string}
  | {ok: false; error: string};

export const submitCategoryName = async (
  text: string,
  user: UserDocument,
  activeCategories: ICategory[],
): Promise<CategoryNameResult> => {
  const count = await countActiveCategories(user.telegramUserId);

  if (count >= 8) {
    user.state = {step: null, payload: {}};
    await user.save();

    return {ok: false, error: CATEGORIES_LIMIT_REACHED_ERROR};
  }

  const normalizedName = normalizeCategoryName(text);

  const existing = activeCategories.some(
    (category) => category.name === normalizedName,
  );

  if (existing) {
    return {ok: false, error: CATEGORY_NAME_EXISTS_ERROR};
  }

  user.state = {
    step: "awaiting_category_type_choice",
    payload: {name: normalizedName},
  };
  await user.save();

  return {ok: true, normalizedName};
};

type CreateCategoryResult =
  | {ok: true; category: ICategory; type: CategoryType; amount: number}
  | {ok: false; error: string};

export const submitCategoryBudget = async (
  text: string,
  user: UserDocument,
): Promise<CreateCategoryResult> => {
  const amount = parseAmount(text);

  if (amount === null || amount < 0) {
    return {ok: false, error: CATEGORY_BUDGET_VALIDATION_ERROR};
  }

  const {name, type} = user.state.payload as {
    name: string;
    type: CategoryType;
  };

  try {
    const category = await createCategory({
      userId: user.telegramUserId,
      name,
      type,
      budget: amount,
    });

    if (type === "monthly") {
      user.state = {
        step: "awaiting_default_category_confirmation",
        payload: {categoryId: String(category._id)},
      };
      await user.save();

      return {ok: true, category, type, amount};
    }

    user.state = {step: null, payload: {}};
    await user.save();

    return {ok: true, category, type, amount};
  } catch {
    return {ok: false, error: CREATE_CATEGORY_ERROR};
  }
};

type ApplyAmountResult =
  | {ok: true; category: ICategory}
  | {ok: false; error: string};

export async function submitCategoryAmount(
  text: string,
  user: UserDocument,
): Promise<ApplyAmountResult> {
  const amount = parseAmount(text);

  if (amount === null) {
    return {ok: false, error: AMOUNT_VALIDATION_ERROR};
  }

  const categoryId = String(
    (user.state.payload as {categoryId?: string}).categoryId ?? "",
  );

  const category = await getCategoryById(categoryId, user.telegramUserId);

  if (!category || category.status !== "active") {
    return {ok: false, error: CATEGORY_NOT_FOUND_ERROR};
  }

  await applyAmount(category, amount);

  return {ok: true, category};
}

type RenameCategoryResult =
  | {ok: true; normalizedName: string}
  | {ok: false; error: string};

export async function processRenameCategory(
  text: string,
  user: UserDocument,
): Promise<RenameCategoryResult> {
  const categoryId = String(
    (user.state.payload as {categoryId?: string}).categoryId ?? "",
  );

  const category = await getCategoryById(categoryId, user.telegramUserId);

  if (!category || category.status !== "active") {
    return {ok: false, error: CATEGORY_NOT_FOUND_ERROR};
  }

  const normalizedName = normalizeCategoryName(text);

  try {
    await renameCategory(category, normalizedName);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "CATEGORY_EXISTS") {
      return {ok: false, error: CATEGORY_NAME_EXISTS_ERROR};
    }
    throw err; // keep unexpected errors visible
  }

  user.state = {step: null, payload: {}};
  await user.save();

  return {ok: true, normalizedName};
}

type UpdateBudgetResult =
  | {ok: true; category: ICategory; amount: number}
  | {ok: false; error: string};

export async function processCategoryBudgetUpdate(
  text: string,
  user: UserDocument,
): Promise<UpdateBudgetResult> {
  const amount = parseAmount(text);

  if (amount === null || amount < 0) {
    return {ok: false, error: CATEGORY_BUDGET_VALIDATION_ERROR};
  }

  const categoryId = String(
    (user.state.payload as {categoryId?: string}).categoryId ?? "",
  );

  const category = await getCategoryById(categoryId, user.telegramUserId);

  if (!category || category.status !== "active") {
    return {ok: false, error: CATEGORY_NOT_FOUND_ERROR};
  }

  await updateCategoryBudget(category, amount);

  user.state = {step: null, payload: {}};
  await user.save();

  return {ok: true, category, amount};
}
