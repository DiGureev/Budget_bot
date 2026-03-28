export function getNowParts(date = new Date()) {
    return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        dateKey: date.toISOString().slice(0, 10),
        monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    };
}
export function monthKey(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
}
export function nextMonth(year, month) {
    if (month === 12)
        return { year: year + 1, month: 1 };
    return { year, month: month + 1 };
}
