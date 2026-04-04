import Category from '../models/Category.js';
import { type ICategory } from '../types.js';
import { getNowParts, monthKey } from '../utils/dates.js';
import { normalizeCategoryName } from '../utils/normalize.js';


export async function countActiveCategories(userId: number): Promise<number> {
  return Category.countDocuments({ userId, status: 'active' });
}

export async function createCategory({
  userId,
  name,
  type,
  budget,
}: {
  userId: number;
  name: string;
  type: 'monthly' | 'annual';
  budget: number;
}): Promise<ICategory> {
  const normalized = normalizeCategoryName(name);

  const existing = await Category.findOne({
    userId,
    nameKey: normalized,
    status: 'active',
  });

  if (existing) {
    throw new Error('CATEGORY_EXISTS');
  }

  const { year, month } = getNowParts();

  const doc = {
    userId,
    name: normalized,
    nameKey: normalized,
    type,
    currentBudget: budget,
    currentSpent: 0,
    period: {
      year,
      month: type === 'monthly' ? month : null,
    },
    history: {
      months: [] as ICategory['history']['months'],
      years: [] as ICategory['history']['years'],
    },
    ...(type === 'annual' ? { currentYearMonthlySpent: new Map<string, number>() } : {}),
  };

  return Category.create(doc);
}

export async function getActiveCategories(userId: number): Promise<ICategory[]> {
  return Category.find({ userId, status: 'active' }).sort({ createdAt: 1 });
}

export async function getCategoryById(
  id: string,
  userId: number
): Promise<ICategory | null> {
  return Category.findOne({ _id: id, userId });
}

export async function applyAmount(category: ICategory, amount: number): Promise<ICategory> {
  const { year, month } = getNowParts();

  if (category.type === 'monthly') {
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
  category.status = 'archived';
  await category.save();
  return category;
}

export async function renameCategory(category: ICategory, newName: string): Promise<ICategory> {
  const normalized = normalizeCategoryName(newName);

  const existing = await Category.findOne({
    userId: category.userId,
    nameKey: normalized,
    status: 'active',
    _id: { $ne: category._id },
  });

  if (existing) {
    throw new Error('CATEGORY_EXISTS');
  }

  category.name = normalized;
  category.nameKey = normalized;
  await category.save();
  return category;
}

export async function updateCategoryBudget(
  category: ICategory,
  newBudget: number
): Promise<ICategory> {
  category.currentBudget = newBudget;
  await category.save();
  return category;
}

export async function resetCategorySpend(category: ICategory): Promise<ICategory> {
  const { year, month } = getNowParts();

  category.currentSpent = 0;

  if (category.type === 'annual') {
    const key = monthKey(year, month);
    category.currentYearMonthlySpent.set(key, 0);
  }

  await category.save();
  return category;
}

export async function convertAnnualToMonthly(category: ICategory): Promise<ICategory> {
  const { year, month } = getNowParts();

  category.type = 'monthly';
  category.currentSpent = 0;
  category.period = { year, month };
  category.currentYearMonthlySpent = new Map();
  category.history.months = [];

  await category.save();
  return category;
}
