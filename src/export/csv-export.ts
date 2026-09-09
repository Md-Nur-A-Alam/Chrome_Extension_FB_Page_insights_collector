import { ContentItem } from '../shared/types';

export class CsvExporter {
  private static escapeCell(value: unknown): string {
    if (value === null || value === undefined) return '""';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  }

  static generateCsv(items: ContentItem[]): string {
    return this.buildCsv(items);
  }

  static buildCsv(items: ContentItem[]): string {
    const headers = [
      'Post ID',
      'Post URL',
      'Page Name',
      'Type',
      'Caption',
      'Published Date',
      'Age Hours',
      'Duration',
      'Views',
      'Reactions',
      'Comments',
      'Shares',
      'Total Engagement',
      'Engagement Rate %',
      'Views Per Hour',
      'Engagement Per Hour',
      'Performance %',
      'Performance Direction',
      'Scraped At'
    ];

    const rows = [headers.join(',')];

    items.forEach((item) => {
      const isReel = item.type === 'reel';
      const duration = isReel ? item.durationFormatted || 'N/A' : 'N/A';

      const row = [
        this.escapeCell(item.id),
        this.escapeCell(item.url || ''),
        this.escapeCell(item.pageName || 'Facebook Page'),
        this.escapeCell(item.type),
        this.escapeCell(item.caption || ''),
        this.escapeCell(item.publishedRelative || 'Recent'),
        item.ageHours !== null ? item.ageHours : '""',
        this.escapeCell(duration),
        item.views !== null ? item.views : '""',
        item.reactions !== null ? item.reactions : '""',
        item.comments !== null ? item.comments : '""',
        item.shares !== null ? item.shares : '""',
        item.totalEngagement !== null ? item.totalEngagement : '""',
        item.engagementRate !== null ? `${item.engagementRate}%` : '""',
        item.viewsPerHour !== null ? item.viewsPerHour : '""',
        item.engagementPerHour !== null ? item.engagementPerHour : '""',
        item.performancePercent !== null ? `${item.performancePercent}%` : '""',
        this.escapeCell(item.performanceDirection),
        this.escapeCell(item.scrapedAt)
      ];

      rows.push(row.join(','));
    });

    // Prepend UTF-8 BOM (\uFEFF) for Excel compatibility with Bengali & emojis
    return '\uFEFF' + rows.join('\r\n');
  }

  static download(items: ContentItem[], filename = 'Facebook_Analytics.csv'): void {
    const csvContent = this.buildCsv(items);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
