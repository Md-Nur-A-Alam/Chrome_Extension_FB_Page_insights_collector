import { describe, it, expect } from 'vitest';
import {
  formatTimeAgo,
  parseDateToIso,
  calculateAgeHours
} from '../../src/shared/utils/date-normalizer';

describe('Date Normalizer', () => {
  describe('formatTimeAgo', () => {
    it('handles relative English phrases correctly', () => {
      expect(formatTimeAgo('5hr ago')).toBe('5hr ago');
      expect(formatTimeAgo('5 hrs ago')).toBe('5hr ago');
      expect(formatTimeAgo('3 days ago')).toBe('3 days ago');
      expect(formatTimeAgo('1 day ago')).toBe('1 day ago');
      expect(formatTimeAgo('2 month ago')).toBe('2 month ago');
      expect(formatTimeAgo('just now')).toBe('Just now');
      expect(formatTimeAgo('yesterday')).toBe('1 day ago');
    });

    it('handles Bengali relative phrases', () => {
      expect(formatTimeAgo('৫ ঘণ্টা আগে')).toBe('5hr ago');
      expect(formatTimeAgo('৩ দিন আগে')).toBe('3 days ago');
      expect(formatTimeAgo('২ মাস আগে')).toBe('2 month ago');
      expect(formatTimeAgo('এইমাত্র')).toBe('Just now');
      expect(formatTimeAgo('গতকাল')).toBe('1 day ago');
    });

    it('formats numeric timestamps dynamically relative to now', () => {
      const now = Date.now();
      const fiveHoursAgo = now - 5 * 3600 * 1000;
      const threeDaysAgo = now - 3 * 24 * 3600 * 1000;

      expect(formatTimeAgo(fiveHoursAgo)).toBe('5hr ago');
      expect(formatTimeAgo(threeDaysAgo)).toBe('3 days ago');
    });

    it('returns "Recent" for empty or null values', () => {
      expect(formatTimeAgo(null)).toBe('Recent');
      expect(formatTimeAgo(undefined)).toBe('Recent');
      expect(formatTimeAgo('')).toBe('Recent');
    });
  });

  describe('parseDateToIso', () => {
    it('converts unix timestamps to ISO string', () => {
      const ts = 1717200000; // seconds
      const iso = parseDateToIso(ts);
      expect(iso).toBe(new Date(ts * 1000).toISOString());
    });

    it('converts date strings to ISO string', () => {
      const iso = parseDateToIso('2026-06-01T12:00:00Z');
      expect(iso).toBe('2026-06-01T12:00:00.000Z');
    });

    it('returns null for unparseable dates', () => {
      expect(parseDateToIso('invalid-date')).toBeNull();
      expect(parseDateToIso(null)).toBeNull();
    });
  });

  describe('calculateAgeHours', () => {
    it('calculates elapsed hours correctly against reference time', () => {
      const ref = Date.parse('2026-09-09T15:00:00.000Z');
      const pub = '2026-09-09T10:00:00.000Z'; // 5 hours prior
      expect(calculateAgeHours(pub, ref)).toBe(5);
    });

    it('returns null for missing or invalid dates', () => {
      expect(calculateAgeHours(null)).toBeNull();
      expect(calculateAgeHours('bad-iso')).toBeNull();
    });
  });
});
