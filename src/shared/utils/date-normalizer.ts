import { convertBengaliDigits } from './number-normalizer';

/**
 * Normalizes a date or timestamp into a relative time length string:
 * e.g., "5hr ago", "3 days ago", "2 month ago", "1 year ago"
 */
export function formatTimeAgo(input: string | number | Date | null | undefined): string {
  if (!input) return 'Recent';

  // 1. If string, check for shorthand / relative phrases
  if (typeof input === 'string') {
    const str = input.trim();
    const converted = convertBengaliDigits(str);

    // Bengali phrases
    if (/(?:এইমাত্র|just now)/i.test(str)) return 'Just now';
    if (/গতকাল/i.test(str)) return '1 day ago';
    const bnHourMatch = converted.match(/(\d+)\s*(?:ঘণ্টা|ঘন্টা)\s*(?:আগে)?/i);
    if (bnHourMatch && bnHourMatch[1]) return `${bnHourMatch[1]}hr ago`;
    const bnDayMatch = converted.match(/(\d+)\s*দিন\s*(?:আগে)?/i);
    if (bnDayMatch && bnDayMatch[1]) return `${bnDayMatch[1]} days ago`;
    const bnMonthMatch = converted.match(/(\d+)\s*মাস\s*(?:আগে)?/i);
    if (bnMonthMatch && bnMonthMatch[1]) return `${bnMonthMatch[1]} month ago`;
    const bnYearMatch = converted.match(/(\d+)\s*বছর\s*(?:আগে)?/i);
    if (bnYearMatch && bnYearMatch[1]) return `${bnYearMatch[1]} year ago`;
    const bnMinMatch = converted.match(/(\d+)\s*মিনিট\s*(?:আগে)?/i);
    if (bnMinMatch && bnMinMatch[1]) return `${bnMinMatch[1]}m ago`;

    // English relative expressions
    if (/^just now$/i.test(str)) return 'Just now';
    if (/^yesterday/i.test(str)) return '1 day ago';

    const hrMatch = str.match(/^(\d+)\s*(?:h|hr|hrs|hours?)\s*(?:ago)?$/i);
    if (hrMatch && hrMatch[1]) return `${hrMatch[1]}hr ago`;

    const dayMatch = str.match(/^(\d+)\s*(?:d|days?)\s*(?:ago)?$/i);
    if (dayMatch && dayMatch[1]) {
      const d = parseInt(dayMatch[1], 10);
      return `${d} ${d === 1 ? 'day' : 'days'} ago`;
    }

    const weekMatch = str.match(/^(\d+)\s*(?:w|wks|weeks?)\s*(?:ago)?$/i);
    if (weekMatch && weekMatch[1]) {
      const w = parseInt(weekMatch[1], 10);
      const days = w * 7;
      return `${days} days ago`;
    }

    const monthMatch = str.match(/^(\d+)\s*(?:m|mo|mos|months?)\s*(?:ago)?$/i);
    if (monthMatch && monthMatch[1]) {
      const m = parseInt(monthMatch[1], 10);
      return `${m} month ago`;
    }

    const yearMatch = str.match(/^(\d+)\s*(?:y|yrs|years?)\s*(?:ago)?$/i);
    if (yearMatch && yearMatch[1]) {
      const y = parseInt(yearMatch[1], 10);
      return `${y} ${y === 1 ? 'year' : 'years'} ago`;
    }

    const minMatch = str.match(/^(\d+)\s*(?:m|min|mins|minutes?)\s*(?:ago)?$/i);
    if (minMatch && minMatch[1]) return `${minMatch[1]}m ago`;
  }

  // 2. Parse numeric timestamp or Date object
  let dateMs: number | null = null;
  if (typeof input === 'number') {
    dateMs = input < 1e11 ? input * 1000 : input;
  } else if (typeof input === 'string') {
    const parsed = Date.parse(input);
    if (!isNaN(parsed)) {
      dateMs = parsed;
    }
  } else if (input instanceof Date) {
    dateMs = input.getTime();
  }

  if (!dateMs) {
    return typeof input === 'string' && input.length < 35 ? input : 'Recent';
  }

  // 3. Compute elapsed difference
  const diffMs = Math.max(0, Date.now() - dateMs);
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}hr ago`;
  if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  if (diffDays < 365) return `${Math.max(1, diffMonths)} month ago`;
  return `${Math.max(1, diffYears)} ${diffYears === 1 ? 'year' : 'years'} ago`;
}

/**
 * Parses raw input into valid ISO 8601 string or null
 */
export function parseDateToIso(input: string | number | Date | null | undefined): string | null {
  if (!input) return null;

  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input.toISOString();
  }

  if (typeof input === 'number') {
    const ms = input < 1e11 ? input * 1000 : input;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  if (typeof input === 'string') {
    const parsed = Date.parse(input);
    if (!isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  return null;
}

/**
 * Calculates elapsed hours from an ISO 8601 published date to reference time (defaults to now)
 */
export function calculateAgeHours(publishedAt: string | null | undefined, referenceTime = Date.now()): number | null {
  if (!publishedAt) return null;
  const parsed = Date.parse(publishedAt);
  if (isNaN(parsed)) return null;

  const diffMs = Math.max(0, referenceTime - parsed);
  return Number((diffMs / (3600 * 1000)).toFixed(2));
}
