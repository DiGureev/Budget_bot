// src/services/amountParser.js
export function parseAmount(input) {
    const raw = String(input).trim().replace(/\s+/g, '');
    if (!/^[+-]?\d+([.,]\d{1,2})?$/.test(raw)) {
      return null;
    }
  
    const normalized = raw.replace(',', '.');
    const amount = Number(normalized);
  
    if (!Number.isFinite(amount) || amount === 0) {
      return null;
    }
  
    return amount;
  }
  