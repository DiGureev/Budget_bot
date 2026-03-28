export function isValidEmail(value?: unknown): boolean {
    if (!value ) return false;
    const email = String(value || '').trim();
  
    // Basic structure check
    const basic = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!basic.test(email)) return false;
  
    // Split parts
    const [local, domain] = email.split('@');
  
    // Length limits (RFC-ish safe bounds)
    if (local.length > 64 || domain.length > 255) return false;
  
    // No consecutive dots
    if (email.includes('..')) return false;
  
    // Local part rules
    if (local.startsWith('.') || local.endsWith('.')) return false;
  
    // Domain rules
    if (domain.startsWith('-') || domain.endsWith('-')) return false;
    if (domain.startsWith('.') || domain.endsWith('.')) return false;
  
    // Domain must have valid labels
    const domainParts = domain.split('.');
    if (domainParts.some(part => part.length === 0)) return false;
  
    // Only allow valid domain characters
    if (!/^[a-zA-Z0-9.-]+$/.test(domain)) return false;
  
    return true;
  }