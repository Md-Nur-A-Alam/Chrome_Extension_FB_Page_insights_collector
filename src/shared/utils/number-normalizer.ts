export const BENGALI_DIGIT_MAP: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
};

export function convertBengaliDigits(str: string): string {
  if (!str) return '';
  return str.replace(/[০-৯]/g, (match) => BENGALI_DIGIT_MAP[match] || match);
}

/**
 * Parses numbers with social media suffixes and localized digits:
 * e.g., "1K" -> 1000, "2.5K" -> 2500, "1M" -> 1000000, "1,234" -> 1234, "১.২ লাখ" -> 120000
 * Returns null if the value cannot be parsed or represents an empty string.
 */
export function parseSocialNumber(rawText: string | number | null | undefined): number | null {
  if (rawText === null || rawText === undefined) return null;
  if (typeof rawText === 'number') return isNaN(rawText) ? null : rawText;

  let text = rawText.toString().trim();
  if (!text || text === 'N/A' || text === 'Unavailable' || text === '—') return null;

  // Convert Bengali numerals
  text = convertBengaliDigits(text);

  // Determine multiplier
  let multiplier = 1;
  if (/কোটি|crore/i.test(text)) {
    multiplier = 10000000;
  } else if (/লাখ|lakh/i.test(text)) {
    multiplier = 100000;
  } else if (/হাজার/i.test(text)) {
    multiplier = 1000;
  } else if (/b\b/i.test(text)) {
    multiplier = 1000000000;
  } else if (/m\b/i.test(text)) {
    multiplier = 1000000;
  } else if (/k\b/i.test(text)) {
    multiplier = 1000;
  }

  // Handle European comma decimals with suffix (e.g. 1,5K -> 1.5K)
  text = text.replace(/(\d+),(\d+)(?=[kmbহাজারলাখকোটি])/i, '$1.$2');
  // Remove formatting commas/separators (e.g. 1,245,678 -> 1245678)
  text = text.replace(/,/g, '');

  const match = text.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!match || !match[1]) return null;

  const num = parseFloat(match[1]);
  if (isNaN(num)) return null;

  return Math.round(num * multiplier);
}

/**
 * Formats a raw number into a neat compact string (e.g., 1250 -> "1.3K", 2500000 -> "2.5M")
 */
export function formatCompactNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return '-';
  if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toLocaleString();
}
