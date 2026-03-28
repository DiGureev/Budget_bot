import Category, { type ICategory } from '../models/Category.js';
import { getNowParts, monthKey } from '../utils/dates.js';
import { normalizeCategoryName } from '../utils/normalize.js';

export async function countActiveCategories(chatId: number): Promise<number> {
  return Category.countDocuments({ chatId, status: 'active' });
}

export async function createCategory({
  chatId,
  name,
  type,
  budget,
}: {
  chatId: number;
  name: string;
  type: 'monthly' | 'annual';
  budget: number;
}): Promise<ICategory> {
  const normalized = normalizeCategoryName(name);

  const existing = await Category.findOne({
    chatId,
    nameKey: normalized,
    status: 'active',
  });

  if (existing) {
    throw new Error('CATEGORY_EXISTS');
  }

  const { year, month } = getNowParts();

  const doc = {
    chatId,
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

export async function getActiveCategories(chatId: number): Promise<ICategory[]> {
  return Category.find({ chatId, status: 'active' }).sort({ createdAt: 1 });
}

export async function getCategoryById(
  id: string,
  chatId: number
): Promise<ICategory | null> {
  return Category.findOne({ _id: id, chatId });
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
    chatId: category.chatId,
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
