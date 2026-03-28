import Category from '../models/Category.js';
import { getNowParts, nextMonth, monthKey } from '../utils/dates.js';
export function trimArray(arr, limit) {
    if (arr.length <= limit)
        return arr;
    return arr.slice(arr.length - limit);
}
export async function ensureUserPeriodsCurrent(userId) {
    const categories = await Category.find({ userId, status: 'active' });
    const now = getNowParts();
    for (const category of categories) {
        if (category.type === 'monthly') {
            await ensureMonthlyCategoryCurrent(category, now);
        }
        else {
            await ensureAnnualCategoryCurrent(category, now);
        }
    }
}
export async function ensureMonthlyCategoryCurrent(category, now) {
    let { year, month } = category.period;
    if (month === null || year === undefined)
        return;
    if (year === now.year && month === now.month)
        return;
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
export async function ensureAnnualCategoryCurrent(category, now) {
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
    const raw = category.currentYearMonthlySpent;
    const map = raw instanceof Map
        ? raw
        : new Map(Object.entries(raw ?? {}).map(([k, v]) => [k, Number(v)]));
    const currentMonth = now.month;
    for (let m = 1; m <= currentMonth; m += 1) {
        const key = monthKey(now.year, m);
        if (!map.has(key)) {
            map.set(key, 0);
        }
    }
    category.currentYearMonthlySpent = map;
    await category.save();
}
