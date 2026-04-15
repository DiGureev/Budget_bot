import type {ICategory, IUser} from "../types.ts";

export function formatMoney(value: number | string): string {
  const num = Number(value || 0);
  return Number.isInteger(num) ? String(num) : num.toFixed(2);
}

export function formatCategoryLine(category: ICategory, user: IUser): string {
  const spent = formatMoney(category.currentSpent);
  const budget = formatMoney(category.currentBudget);
  const isDefault =
    user.defaultCategoryId &&
    String(user.defaultCategoryId) === String(category._id);

  return `${category.name} ${spent}/${budget}${isDefault ? " ⭐" : ""}`;
}

export function formatCategoryDetails(
  category: ICategory,
  showButtons: boolean = true,
): string {
  const spent = Number(category.currentSpent || 0);
  const budget = Number(category.currentBudget || 0);
  const remaining = budget - spent;
  const label = category.type === "annual" ? "Annual Budget" : "Monthly Budget";

  return `${category.name} · ${label}: ${formatMoney(budget)}\n\nSpent: ${formatMoney(spent)}\nRemaining: ${formatMoney(remaining)}.${showButtons ? `\n\nEnter an expense for the "${category.name}" category, or choose another action using the buttons below.` : ""}`;
}

export function formatMonthlyHistory(category: ICategory): string {
  const budget = Number(category.currentBudget || 0);
  const months = [...(category.history?.months || [])].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  if (!months.length) {
    return `📊 History — ${category.name} (Monthly, ${formatMoney(budget)})\n\nNo previous months yet.`;
  }

  const lines = months.map((item) => {
    const over = Number(item.spent) - Number(item.budget);
    const icon = over > 0 ? "⚠️" : "✅";
    const suffix = over > 0 ? ` (over by ${formatMoney(over)})` : "";
    return `${icon} ${monthName(item.month)} ${item.year} — spent ${formatMoney(item.spent)} / ${formatMoney(item.budget)}${suffix}`;
  });

  return `📊 History — ${category.name} (Monthly, ${formatMoney(budget)})

${lines.join("\n\n")}`;
}

export function formatAnnualHistory(category: ICategory): string {
  const budget = Number(category.currentBudget || 0);
  const monthly = category.currentYearMonthlySpent || new Map<string, number>();
  const monthEntries = mapEntries(monthly)
    .sort((a, b) => (a.key < b.key ? 1 : -1))
    .map(({key, value}) => {
      const [, m] = key.split("-");
      return `${monthName(Number(m))} ${category.period.year} — spent ${formatMoney(value)}`;
    });

  const yearLines = [...(category.history?.years || [])]
    .sort((a, b) => b.year - a.year)
    .map(
      (item) =>
        `${item.year} — ${formatMoney(item.spent)}/${formatMoney(item.budget)}`,
    );

  const spent = Number(category.currentSpent || 0);
  const remaining = budget - spent;

  return `📊 History — ${category.name} (Annual, ${formatMoney(budget)})\n\n${monthEntries.length ? monthEntries.join("\n\n") : "No monthly history for this year yet."}\n\nTotal spent for ${category.period.year}: ${formatMoney(spent)} / ${formatMoney(budget)}\nRemaining for ${category.period.year}: ${formatMoney(remaining)}\n\n${yearLines.length ? `Previous years:\n\n${yearLines.join("\n")}` : "No previous years yet."}`;
}

export function formatRemovePrompt(category: ICategory): string {
  return `⚠️ Are you sure you want to remove "${category.name}"?\n\nThe category will be archived and hidden from the menu.\n\nHistory will stay saved.`;
}

export function monthName(month: number): string {
  return [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ][month];
}

export function mapEntries(
  mapLike: Map<string, number> | Record<string, number> | undefined,
) {
  if (!mapLike) return [];
  if (
    typeof mapLike === "object" &&
    "entries" in mapLike &&
    typeof mapLike.entries === "function"
  ) {
    return Array.from(mapLike.entries()).map(([key, value]) => ({key, value}));
  }
  return Object.entries(mapLike as Record<string, number>).map(
    ([key, value]) => ({
      key,
      value,
    }),
  );
}
