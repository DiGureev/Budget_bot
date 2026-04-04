export function getNowParts(date: Date = new Date()) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    dateKey: date.toISOString().slice(0, 10),
    monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
  };
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function nextMonth(
  year: number,
  month: number
): {year: number; month: number} {
  if (month === 12) return {year: year + 1, month: 1};
  return {year, month: month + 1};
}
