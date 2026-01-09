/**
 * Currency formatting utilities for the frontend application.
 * All prices are guaranteed to be displayed in Russian Rubles (RUB).
 */

/**
 * Formats a number as Russian Rubles currency.
 * @param amount - The amount to format
 * @returns Formatted currency string in Russian locale (e.g., "1 234,56 ₽")
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
  }).format(amount);
};

/**
 * Formats a number as Russian Rubles currency without the currency symbol.
 * @param amount - The amount to format
 * @returns Formatted number string in Russian locale (e.g., "1 234,56")
 */
export const formatCurrencyNumber = (amount: number): string => {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Formats a number as Russian Rubles currency with custom decimal places.
 * @param amount - The amount to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted currency string
 */
export const formatCurrencyWithDecimals = (amount: number, decimals: number = 2): string => {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
};
