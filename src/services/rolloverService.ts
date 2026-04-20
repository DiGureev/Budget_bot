import Category from "../models/Category.js";
import {getNowParts, nextMonth, monthKey} from "../utils/dates.js";
import {ICategory} from "../types.js";

export function trimArray<T>(arr: T[], limit: number): T[] {
  if (arr.length <= limit) return arr;
  return arr.slice(arr.length - limit);
}

type NowParts = ReturnType<typeof getNowParts>;

export async function ensureUserPeriodsCurrent(userId: number): Promise<void> {
  const categories = await Category.find({userId, status: "active"});
  const now = getNowParts();

  for (const category of categories) {
    if (category.type === "monthly") {
      await ensureMonthlyCategoryCurrent(category, now);
    } else {
      await ensureAnnualCategoryCurrent(category, now);
    }
  }
}

export async function ensureMonthlyCategoryCurrent(
  category: ICategory,
  now: NowParts,
): Promise<void> {
  let {year, month} = category.period;

  if (month === null || year === undefined) return;

  if (year === now.year && month === now.month) return;

  category.history.months.push({
    year,
    month,
    budget: category.currentBudget,
    spent: category.currentSpent,
  });

  let cursor = nextMonth(year, month);

  while (cursor.year !== now.year || cursor.month !== now.month) {
    category.history.months.push({
      year: cursor.year,
      month: cursor.month,
      budget: category.currentBudget,
      spent: 0,
    });
    cursor = nextMonth(cursor.year, cursor.month);
  }

  category.history.months = trimArray(category.history.months, 12);
  category.currentSpent = 0;
  category.period.year = now.year;
  category.period.month = now.month;

  await category.save();
}

export async function ensureAnnualCategoryCurrent(
  category: ICategory,
  now: NowParts,
): Promise<void> {
  const currentYear = category.period.year;

  if (currentYear !== now.year) {
    category.history.years.push({
      year: currentYear,
      budget: category.currentBudget,
      spent: category.currentSpent,
    });
    category.history.years = trimArray(category.history.years, 5);
    category.currentSpent = 0;
    category.period.year = now.year;
    category.currentYearMonthlySpent = new Map();
  }

  // Clean up any phantom zero entries
  for (const [key, spent] of category.currentYearMonthlySpent.entries()) {
    if (spent === 0) {
      category.currentYearMonthlySpent.delete(key);
    }
  }

  await category.save();
}
