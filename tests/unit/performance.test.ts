import { describe, it, expect } from 'vitest';
import { PerformanceEngine } from '../../src/analytics/performance';
import { ContentItem } from '../../src/shared/types';

describe('Performance Engine', () => {
  const createMockItem = (
    id: string,
    type: 'post' | 'reel',
    views: number | null,
    totalEngagement: number | null,
    engagementRate: number | null = null,
    engagementPerHour: number | null = null
  ): ContentItem => {
    const base = {
      id,
      platform: 'facebook' as const,
      pageName: 'Test Page',
      caption: `Sample caption for ${id}`,
      url: `https://facebook.com/${id}`,
      publishedAt: '2026-06-01T12:00:00Z',
      publishedRelative: '2 days ago',
      ageHours: 48,
      scrapedAt: '2026-06-03T12:00:00Z',
      reactions: 100,
      comments: 20,
      shares: 5,
      views,
      totalEngagement,
      engagementRate,
      viewsPerHour: null,
      engagementPerHour,
      performancePercent: null,
      performanceDirection: 'unknown' as const,
      dataQualityScore: 90,
      extractionStatus: 'complete' as const,
      extractionWarnings: [],
      rawFingerprint: id
    };

    if (type === 'reel') {
      return {
        ...base,
        type: 'reel' as const,
        durationSeconds: null,
        durationFormatted: null,
        thumbnailUrl: null,
        mediaUrl: null
      };
    }

    return {
      ...base,
      type: 'post' as const,
      media: [],
      postFormat: 'text' as const,
      videoDurationSeconds: null,
      videoDurationFormatted: null
    };
  };

  describe('calculatePerformance (Cold Start Protection)', () => {
    it('returns Insufficient Data when baseline pool has fewer than 5 items', () => {
      const item = createMockItem('target', 'reel', 1000, 100, 10.0);
      const pool = [
        createMockItem('r1', 'reel', 1000, 100),
        createMockItem('r2', 'reel', 1200, 120)
      ];

      const res = PerformanceEngine.calculatePerformance(item, pool);
      expect(res.performancePercent).toBeNull();
      expect(res.performanceDirection).toBe('unknown');
      expect(res.performanceLabel).toBe('Insufficient Data');
    });
  });

  describe('calculatePerformance (Reel Scoring)', () => {
    it('calculates positive deviation for high-performing Reel', () => {
      const pool: ContentItem[] = [
        createMockItem('r1', 'reel', 1000, 50, 5.0),
        createMockItem('r2', 'reel', 1000, 50, 5.0),
        createMockItem('r3', 'reel', 1000, 50, 5.0),
        createMockItem('r4', 'reel', 1000, 50, 5.0),
        createMockItem('r5', 'reel', 1000, 50, 5.0)
      ];

      // Item with 2000 views (+100%) and 100 engagement (+100%)
      const highItem = createMockItem('target', 'reel', 2000, 100, 5.0);
      const res = PerformanceEngine.calculatePerformance(highItem, pool);

      expect(res.performancePercent).toBeGreaterThan(50);
      expect(res.performanceDirection).toBe('up');
      expect(res.performanceLabel).toBe('Excellent');
    });

    it('calculates negative deviation for under-performing Reel', () => {
      const pool: ContentItem[] = [
        createMockItem('r1', 'reel', 10000, 500, 5.0),
        createMockItem('r2', 'reel', 10000, 500, 5.0),
        createMockItem('r3', 'reel', 10000, 500, 5.0),
        createMockItem('r4', 'reel', 10000, 500, 5.0),
        createMockItem('r5', 'reel', 10000, 500, 5.0)
      ];

      // Underperforming item: 2000 views (-80%), 50 engagement (-90%)
      const lowItem = createMockItem('target', 'reel', 2000, 50, 2.5);
      const res = PerformanceEngine.calculatePerformance(lowItem, pool);

      expect(res.performancePercent).toBeLessThan(-50);
      expect(res.performanceDirection).toBe('down');
      expect(res.performanceLabel).toBe('Poor');
    });
  });

  describe('calculatePerformance (Post Scoring)', () => {
    it('evaluates post performance against post baseline', () => {
      const pool: ContentItem[] = [
        createMockItem('p1', 'post', null, 100, null, 10),
        createMockItem('p2', 'post', null, 100, null, 10),
        createMockItem('p3', 'post', null, 100, null, 10),
        createMockItem('p4', 'post', null, 100, null, 10),
        createMockItem('p5', 'post', null, 100, null, 10)
      ];

      const postItem = createMockItem('target', 'post', null, 120, null, 12);
      const res = PerformanceEngine.calculatePerformance(postItem, pool);

      expect(res.performancePercent).toBe(20.0);
      expect(res.performanceDirection).toBe('up');
      expect(res.performanceLabel).toBe('Above Average');
    });
  });
});
