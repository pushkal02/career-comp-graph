export const EXCHANGE_RATES = {
  USD: 1.0,
  INR: 83.0,
  GBP: 0.79,
  EUR: 0.92,
  JPY: 155.0,
  CAD: 1.37,
  AUD: 1.51,
  SGD: 1.35
};

/**
 * Converts a monetary amount from one currency to another using static exchange rates.
 * @param {number} amount - The amount to convert.
 * @param {string} from - The source currency code (e.g. 'USD').
 * @param {string} to - The target currency code (e.g. 'INR').
 * @returns {number} The converted amount.
 */
export function convertCurrency(amount, from = 'USD', to = 'USD') {
  const f = from || 'USD';
  const t = to || 'USD';
  if (f === t) return amount;
  const usdAmount = amount / (EXCHANGE_RATES[f] || 1.0);
  return usdAmount * (EXCHANGE_RATES[t] || 1.0);
}
