import { getDatabase } from '../indexed-db';
import { ContentItem } from '../../shared/types';

export class ContentRepository {
  /**
   * Saves or updates a content item, preserving historical performance snapshots
   */
  static async saveOrUpdate(item: ContentItem): Promise<void> {
    const db = await getDatabase();
    const existing = await db.get('contents', item.id);

    if (existing) {
      // Save performance snapshot before updating
      await db.add('performance_snapshots', {
        contentId: item.id,
        pageId: item.pageName || 'page',
        scrapedAt: existing.scrapedAt,
        views: existing.views,
        reactions: existing.reactions,
        comments: existing.comments,
        shares: existing.shares,
        totalEngagement: existing.totalEngagement
      });
    }

    await db.put('contents', item);
  }

  /**
   * Saves multiple items in a single transaction
   */
  static async saveAll(items: ContentItem[]): Promise<void> {
    for (const item of items) {
      await this.saveOrUpdate(item);
    }
  }

  /**
   * Retrieves all content items
   */
  static async getAll(): Promise<ContentItem[]> {
    const db = await getDatabase();
    return db.getAll('contents');
  }

  /**
   * Retrieves content items filtered by type ('post' | 'reel')
   */
  static async getByType(type: 'post' | 'reel'): Promise<ContentItem[]> {
    const db = await getDatabase();
    return db.getAllFromIndex('contents', 'by-type', type);
  }

  /**
   * Clears all content items and snapshots
   */
  static async clearAll(): Promise<void> {
    const db = await getDatabase();
    await db.clear('contents');
    await db.clear('performance_snapshots');
  }
}
