import Category from "../models/Category.js";
import {CategoryType, type ICategory} from "../types.js";
import {getNowParts, monthKey} from "../utils/dates.js";
import {normalizeCategoryName, trimArray} from "../utils/normalize.js";

export async function countActiveCategories(userId: number): Promise<number> {
  return Category.countDocuments({userId, status: "active"});
}

export async function createCategory({
  userId,
  name,
  type,
  budget,
}: {
  userId: number;
  name: string;
  type: CategoryType;
  budget: number;
}): Promise<ICategory> {
  const normalized = normalizeCategoryName(name);

  const existing = await Category.findOne({
    userId,
    nameKey: normalized,
    status: "active",
  });

  if (existing) {
    throw new Error("CATEGORY_EXISTS");
  }

  const {year, month} = getNowParts();

  const doc = {
    userId,
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
  userId: number,
): Promise<ICategory[]> {
  return Category.find({userId, status: "active"}).sort({createdAt: 1});
}

export async function getCategoryById(
  id: string,
  userId: number,
): Promise<ICategory | null> {
  return Category.findOne({_id: id, userId});
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
    userId: category.userId,
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
  const currentMonthKey = monthKey(year, month);

  // Migrate currentYearMonthlySpent into history.months
  const months: ICategory["history"]["months"] = [];
  for (const [key, spent] of category.currentYearMonthlySpent.entries()) {
    const [entryYear, entryMonth] = key.split("-").map(Number);
    if (entryYear === year && entryMonth !== month) {
      months.push({
        year: entryYear,
        month: entryMonth,
        budget: category.currentBudget,
        spent,
      });
    }
  }

  category.type = "monthly";
  category.currentSpent =
    category.currentYearMonthlySpent.get(currentMonthKey) ?? 0; // current month only
  category.period = {year, month};
  category.currentYearMonthlySpent = new Map();
  category.history.months = trimArray(months, 12);

  await category.save();
  return category;
}

export async function convertMonthlyToAnnual(
  category: ICategory,
): Promise<void> {
  const currentYear = category.period.year;

  // Migrate history.months into currentYearMonthlySpent
  const migratedMap = new Map<string, number>();

  for (const entry of category.history.months) {
    if (entry.year === currentYear) {
      const key = monthKey(entry.year, entry.month);
      migratedMap.set(key, entry.spent);
    }
  }

  // Add current active month
  const currentMonthKey = monthKey(currentYear, category.period.month!);
  migratedMap.set(currentMonthKey, category.currentSpent);

  const yearlySpent = Array.from(migratedMap.values()).reduce(
    (sum, val) => sum + val,
    0,
  );

  category.type = "annual";
  category.period = {year: currentYear, month: null};
  category.currentSpent = yearlySpent;
  category.currentYearMonthlySpent = migratedMap;
  category.history.months = [];

  await category.save();
}
