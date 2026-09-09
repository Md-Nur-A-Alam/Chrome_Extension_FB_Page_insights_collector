import { describe, it, expect } from 'vitest';
import { parseSocialNumber, formatCompactNumber } from '../../src/shared/utils/number-normalizer';

describe('Number Normalizer', () => {
  describe('parseSocialNumber (English)', () => {
    it('parses standard comma-separated integers', () => {
      expect(parseSocialNumber('1,234')).toBe(1234);
      expect(parseSocialNumber('1,245,678')).toBe(1245678);
      expect(parseSocialNumber('42')).toBe(42);
      expect(parseSocialNumber('0')).toBe(0);
    });

    it('parses shorthand abbreviations (K, M, B)', () => {
      expect(parseSocialNumber('1.5K')).toBe(1500);
      expect(parseSocialNumber('2.5M')).toBe(2500000);
      expect(parseSocialNumber('1.2B')).toBe(1200000000);
      expect(parseSocialNumber('500k')).toBe(500000);
    });

    it('parses counts with trailing words or labels', () => {
      expect(parseSocialNumber('1.2M views')).toBe(1200000);
      expect(parseSocialNumber('45K comments')).toBe(45000);
      expect(parseSocialNumber('350 shares')).toBe(350);
      expect(parseSocialNumber('1,245 reactions')).toBe(1245);
    });

    it('returns null for invalid inputs', () => {
      expect(parseSocialNumber('')).toBeNull();
      expect(parseSocialNumber(null)).toBeNull();
      expect(parseSocialNumber(undefined)).toBeNull();
      expect(parseSocialNumber('No views')).toBeNull();
    });
  });

  describe('parseSocialNumber (Bengali Numerals & Locales)', () => {
    it('converts Bengali digits to standard integers', () => {
      expect(parseSocialNumber('১২৩৪')).toBe(1234);
      expect(parseSocialNumber('৪৫')).toBe(45);
      expect(parseSocialNumber('০')).toBe(0);
    });

    it('handles Bengali multipliers (হাজার, লাখ, কোটি)', () => {
      expect(parseSocialNumber('৫০ হাজার')).toBe(50000);
      expect(parseSocialNumber('১.৫ লাখ')).toBe(150000);
      expect(parseSocialNumber('২ কোটি')).toBe(20000000);
    });

    it('handles mixed Bengali text labels', () => {
      expect(parseSocialNumber('১২.৫K বার দেখা হয়েছে')).toBe(12500);
      expect(parseSocialNumber('৩৫০টি মন্তব্য')).toBe(350);
    });
  });

  describe('formatCompactNumber', () => {
    it('formats counts into readable compact representations', () => {
      expect(formatCompactNumber(0)).toBe('0');
      expect(formatCompactNumber(850)).toBe('850');
      expect(formatCompactNumber(1500)).toBe('1.5K');
      expect(formatCompactNumber(2500000)).toBe('2.5M');
      expect(formatCompactNumber(null)).toBe('-');
    });
  });
});
