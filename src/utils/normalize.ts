export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function trimArray<T>(arr: T[], limit: number): T[] {
  if (arr.length <= limit) return arr;
  return arr.slice(arr.length - limit);
}
