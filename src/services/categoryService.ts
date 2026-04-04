import Category from "../models/Category.js";
import {CategoryType, type ICategory, type Context} from "../types.js";
import {getNowParts, monthKey} from "../utils/dates.js";
import {normalizeCategoryName} from "../utils/normalize.js";

export async function countActiveCategories(context: Context): Promise<number> {
  return Category.countDocuments({
    ownerId: context.ownerId,
    ownerType: context.ownerType,
    status: "active",
  });
}

export async function createCategory({
  context,
  name,
  type,
  budget,
}: {
  context: Context;
  name: string;
  type: CategoryType;
  budget: number;
}): Promise<ICategory> {
  const normalized = normalizeCategoryName(name);

  const existing = await Category.findOne({
    ownerId: context.ownerId,
    ownerType: context.ownerType,
    nameKey: normalized,
    status: "active",
  });

  if (existing) {
    throw new Error("CATEGORY_EXISTS");
  }

  const {year, month} = getNowParts();

  const doc = {
    ownerId: context.ownerId,
    ownerType: context.ownerType,

    name: normalized,
    nameKey: normalized,

    type,
    currentBudget: budget,
    currentSpent: 0,

    period: {
      year,
      month: type === "monthly" ? month : null,
    },

    history: {
      months: [] as ICategory["history"]["months"],
      years: [] as ICategory["history"]["years"],
    },

    ...(type === "annual"
      ? {currentYearMonthlySpent: new Map<string, number>()}
      : {}),
  };

  return Category.create(doc);
}

export async function getActiveCategories(
  context: Context,
): Promise<ICategory[]> {
  return Category.find({
    ownerId: context.ownerId,
    ownerType: context.ownerType,
    status: "active",
  }).sort({createdAt: 1});
}

export async function getCategoryById(
  id: string,
  context: Context,
): Promise<ICategory | null> {
  return Category.findOne({
    _id: id,
    ownerId: context.ownerId,
    ownerType: context.ownerType,
  });
}

export async function applyAmount(
  category: ICategory,
  amount: number,
): Promise<ICategory> {
  const {year, month} = getNowParts();

  if (category.type === "monthly") {
    category.currentSpent += amount;
  } else {
    category.currentSpent += amount;

    const key = monthKey(year, month);
    const current = category.currentYearMonthlySpent?.get(key) || 0;
    category.currentYearMonthlySpent.set(key, current + amount);
  }

  await category.save();
  return category;
}

export async function archiveCategory(category: ICategory): Promise<ICategory> {
  category.status = "archived";
  await category.save();
  return category;
}

export async function renameCategory(
  category: ICategory,
  newName: string,
): Promise<ICategory> {
  const normalized = normalizeCategoryName(newName);

  const existing = await Category.findOne({
    ownerId: category.ownerId,
    ownerType: category.ownerType,
    nameKey: normalized,
    status: "active",
    _id: {$ne: category._id},
  });

  if (existing) {
    throw new Error("CATEGORY_EXISTS");
  }

  category.name = normalized;
  category.nameKey = normalized;

  await category.save();
  return category;
}

export async function updateCategoryBudget(
  category: ICategory,
  newBudget: number,
): Promise<ICategory> {
  category.currentBudget = newBudget;
  await category.save();
  return category;
}

export async function resetCategorySpend(
  category: ICategory,
): Promise<ICategory> {
  const {year, month} = getNowParts();

  category.currentSpent = 0;

  if (category.type === "annual") {
    const key = monthKey(year, month);
    category.currentYearMonthlySpent.set(key, 0);
  }

  await category.save();
  return category;
}

export async function convertAnnualToMonthly(
  category: ICategory,
): Promise<ICategory> {
  const {year, month} = getNowParts();

  category.type = "monthly";
  category.currentSpent = category.currentBudget;
  category.period = {year, month};
  category.currentYearMonthlySpent = new Map();
  category.history.months = [];

  await category.save();
  return category;
}

export async function convertMonthlyToAnnual(
  category: ICategory,
): Promise<void> {
  const yearlySpent = Array.from(
    category.currentYearMonthlySpent.values(),
  ).reduce((sum, val) => sum + val, 0);

  category.type = "annual";

  category.period = {year: category.period.year, month: null};

  category.history.years.push({
    year: category.period.year,
    budget: category.currentBudget,
    spent: yearlySpent,
  });

  category.currentSpent = yearlySpent;

  category.currentYearMonthlySpent = new Map();
  category.history.months = [];

  await category.save();
}
