import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { ContentItem, PageProfile, PerformanceSnapshot, ScrapeSession } from '../shared/types';

interface FacebookAnalyticsDBSchema extends DBSchema {
  contents: {
    key: string;
    value: ContentItem;
    indexes: {
      'by-type': string;
      'by-page': string;
      'by-scraped': string;
    };
  };
  pages: {
    key: string;
    value: PageProfile;
  };
  performance_snapshots: {
    key: number;
    value: PerformanceSnapshot;
    indexes: {
      'by-content': string;
      'by-scraped': string;
    };
  };
  scrape_sessions: {
    key: string;
    value: ScrapeSession;
  };
}

const DB_NAME = 'FacebookAnalyticsDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<FacebookAnalyticsDBSchema>> | null = null;

export function getDatabase(): Promise<IDBPDatabase<FacebookAnalyticsDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<FacebookAnalyticsDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Contents Store
        if (!db.objectStoreNames.contains('contents')) {
          const contentStore = db.createObjectStore('contents', { keyPath: 'id' });
          contentStore.createIndex('by-type', 'type');
          contentStore.createIndex('by-page', 'pageName');
          contentStore.createIndex('by-scraped', 'scrapedAt');
        }

        // Pages Store
        if (!db.objectStoreNames.contains('pages')) {
          db.createObjectStore('pages', { keyPath: 'id' });
        }

        // Performance Snapshots Store
        if (!db.objectStoreNames.contains('performance_snapshots')) {
          const snapStore = db.createObjectStore('performance_snapshots', {
            keyPath: 'id',
            autoIncrement: true
          });
          snapStore.createIndex('by-content', 'contentId');
          snapStore.createIndex('by-scraped', 'scrapedAt');
        }

        // Scrape Sessions Store
        if (!db.objectStoreNames.contains('scrape_sessions')) {
          db.createObjectStore('scrape_sessions', { keyPath: 'sessionId' });
        }
      }
    });
  }
  return dbPromise;
}
