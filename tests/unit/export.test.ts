import { describe, it, expect } from 'vitest';
import { CsvExporter } from '../../src/export/csv-export';
import { JsonExporter } from '../../src/export/json-export';
import { ContentItem } from '../../src/shared/types';

describe('Export Subsystem', () => {
  const sampleItems: ContentItem[] = [
    {
      id: 'post_1001',
      platform: 'facebook',
      pageName: 'Tech Central',
      type: 'post',
      caption: 'Big announcement: "Next-gen AI" is here, stay tuned!',
      url: 'https://facebook.com/techcentral/posts/1001',
      publishedAt: '2026-06-01T10:00:00Z',
      publishedRelative: '5hr ago',
      ageHours: 5,
      scrapedAt: '2026-06-01T15:00:00Z',
      reactions: 1250,
      comments: 340,
      shares: 85,
      views: null,
      totalEngagement: 1675,
      engagementRate: null,
      viewsPerHour: null,
      engagementPerHour: 335.0,
      performancePercent: 24.5,
      performanceDirection: 'up',
      dataQualityScore: 95,
      extractionStatus: 'complete',
      extractionWarnings: [],
      rawFingerprint: 'post_1001_preview',
      media: [],
      postFormat: 'text',
      videoDurationSeconds: null,
      videoDurationFormatted: null
    },
    {
      id: 'reel_2002',
      platform: 'facebook',
      pageName: 'Tech Central',
      type: 'reel',
      caption: 'Top 5 Productivity Hacks in 2026',
      url: 'https://facebook.com/reel/2002',
      publishedAt: '2026-05-30T10:00:00Z',
      publishedRelative: '2 days ago',
      ageHours: 48,
      scrapedAt: '2026-06-01T10:00:00Z',
      reactions: 4500,
      comments: 620,
      shares: 110,
      views: 75000,
      totalEngagement: 5230,
      engagementRate: 6.97,
      viewsPerHour: 1562.5,
      engagementPerHour: 108.96,
      performancePercent: 42.0,
      performanceDirection: 'up',
      dataQualityScore: 98,
      extractionStatus: 'complete',
      extractionWarnings: [],
      rawFingerprint: 'reel_2002_preview',
      durationSeconds: 185,
      durationFormatted: '3 min 5 sec',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      mediaUrl: 'https://example.com/video.mp4'
    }
  ];

  describe('CsvExporter', () => {
    it('generates CSV with UTF-8 BOM and properly escapes quotes and commas', () => {
      const csv = CsvExporter.generateCsv(sampleItems);

      // Must start with UTF-8 BOM (\uFEFF)
      expect(csv.charCodeAt(0)).toBe(0xfeff);

      // Header row check
      expect(csv).toContain('Post ID,Post URL,Page Name,Type,Caption');

      // Escaped double quotes check: "Next-gen AI" -> ""Next-gen AI""
      expect(csv).toContain('""Next-gen AI""');

      // Duration formatting in Reel
      expect(csv).toContain('3 min 5 sec');
    });
  });

  describe('JsonExporter', () => {
    it('produces formatted structured JSON output', () => {
      const json = JsonExporter.generateJson(sampleItems);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe('post_1001');
      expect(parsed[1].durationFormatted).toBe('3 min 5 sec');
      expect(parsed[1].views).toBe(75000);
    });
  });
});
