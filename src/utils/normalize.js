export function normalizeCategoryName(name) {
    return name
      .trim()
      .replace(/\s+/g, ' ');
  }