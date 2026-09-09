import * as XLSX from 'xlsx';
import { ContentItem } from '../shared/types';

export class XlsxExporter {
  static download(items: ContentItem[], filename = 'Facebook_Analytics_Workbook.xlsx'): void {
    const wb = XLSX.utils.book_new();

    // 1. Summary Sheet
    const posts = items.filter((i) => i.type === 'post');
    const reels = items.filter((i) => i.type === 'reel');
    const totalViews = items.reduce((sum, i) => sum + (i.views || 0), 0);
    const totalReactions = items.reduce((sum, i) => sum + (i.reactions || 0), 0);
    const totalComments = items.reduce((sum, i) => sum + (i.comments || 0), 0);
    const totalShares = items.reduce((sum, i) => sum + (i.shares || 0), 0);

    const summaryData = [
      ['Metric', 'Value'],
      ['Total Content Items', items.length],
      ['Total Posts', posts.length],
      ['Total Reels', reels.length],
      ['Total Views (Visible)', totalViews],
      ['Total Reactions', totalReactions],
      ['Total Comments', totalComments],
      ['Total Shares', totalShares],
      ['Total Engagement', totalReactions + totalComments + totalShares],
      ['Export Generated At', new Date().toISOString()]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // 2. Posts Sheet
    const postRows = posts.map((p) => ({
      'Post ID': p.id,
      'Post URL': p.url || '',
      Caption: p.caption || '',
      Published: p.publishedRelative || 'Recent',
      'Age (Hours)': p.ageHours ?? 'Unavailable',
      Reactions: p.reactions ?? 'Unavailable',
      Comments: p.comments ?? 'Unavailable',
      Shares: p.shares ?? 'Unavailable',
      'Total Engagement': p.totalEngagement ?? 'Unavailable',
      'Engagement / Hour': p.engagementPerHour ?? 'Unavailable',
      'Performance %': p.performancePercent !== null ? `${p.performancePercent}%` : 'Unavailable',
      Direction: p.performanceDirection,
      'Scraped At': p.scrapedAt
    }));
    const wsPosts = XLSX.utils.json_to_sheet(postRows);
    XLSX.utils.book_append_sheet(wb, wsPosts, 'Posts');

    // 3. Reels Sheet
    const reelRows = reels.map((r) => ({
      'Reel ID': r.id,
      'Reel URL': r.url || '',
      Caption: r.caption || '',
      Duration: r.durationFormatted || 'N/A',
      Published: r.publishedRelative || 'Recent',
      'Age (Hours)': r.ageHours ?? 'Unavailable',
      Views: r.views ?? 'Unavailable',
      Reactions: r.reactions ?? 'Unavailable',
      Comments: r.comments ?? 'Unavailable',
      Shares: r.shares ?? 'Unavailable',
      'Total Engagement': r.totalEngagement ?? 'Unavailable',
      'Engagement Rate %': r.engagementRate !== null ? `${r.engagementRate}%` : 'Unavailable',
      'Views / Hour': r.viewsPerHour ?? 'Unavailable',
      'Performance %': r.performancePercent !== null ? `${r.performancePercent}%` : 'Unavailable',
      Direction: r.performanceDirection,
      'Scraped At': r.scrapedAt
    }));
    const wsReels = XLSX.utils.json_to_sheet(reelRows);
    XLSX.utils.book_append_sheet(wb, wsReels, 'Reels');

    // Trigger XLSX binary download
    XLSX.writeFile(wb, filename);
  }
}
