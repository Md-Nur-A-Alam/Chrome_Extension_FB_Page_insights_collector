import { describe, it, expect } from 'vitest';
import {
  parseDurationToSeconds,
  formatVideoDuration
} from '../../src/shared/utils/duration-normalizer';

describe('Duration Normalizer', () => {
  describe('parseDurationToSeconds', () => {
    it('parses colon-formatted MM:SS time strings', () => {
      expect(parseDurationToSeconds('0:45')).toBe(45);
      expect(parseDurationToSeconds('3:05')).toBe(185);
      expect(parseDurationToSeconds('12:30')).toBe(750);
    });

    it('parses colon-formatted HH:MM:SS time strings', () => {
      expect(parseDurationToSeconds('1:15:30')).toBe(4530);
      expect(parseDurationToSeconds('01:00:00')).toBe(3600);
    });

    it('parses natural language duration strings', () => {
      expect(parseDurationToSeconds('3 min 5 sec')).toBe(185);
      expect(parseDurationToSeconds('30 min 43 sec')).toBe(1843);
      expect(parseDurationToSeconds('45 sec')).toBe(45);
      expect(parseDurationToSeconds('1 hr 20 min')).toBe(4800);
      expect(parseDurationToSeconds('1 hour 5 minutes 10 seconds')).toBe(3910);
    });

    it('returns null for empty or invalid values', () => {
      expect(parseDurationToSeconds('')).toBeNull();
      expect(parseDurationToSeconds(null)).toBeNull();
      expect(parseDurationToSeconds(undefined)).toBeNull();
      expect(parseDurationToSeconds('random string')).toBeNull();
    });
  });

  describe('formatVideoDuration', () => {
    it('formats seconds into human readable duration strings', () => {
      expect(formatVideoDuration(45)).toBe('45 sec');
      expect(formatVideoDuration(185)).toBe('3 min 5 sec');
      expect(formatVideoDuration(1843)).toBe('30 min 43 sec');
      expect(formatVideoDuration(3665)).toBe('1 hr 1 min 5 sec');
    });

    it('returns null for zero or negative values', () => {
      expect(formatVideoDuration(0)).toBeNull();
      expect(formatVideoDuration(-10)).toBeNull();
      expect(formatVideoDuration(null)).toBeNull();
    });
  });
});
