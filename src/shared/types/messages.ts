import { ContentItem, PageProfile } from './index';

export interface ScrapeOptions {
  targetCount: number;
  mode: 'posts' | 'reels' | 'both';
  delayMs?: number;
  dateFilter?: 'all' | 'today' | '7d' | '30d' | '90d';
}

export interface ScrapeProgress {
  status: 'idle' | 'preparing' | 'scanning' | 'extracting' | 'saving' | 'completed' | 'paused' | 'cancelled' | 'failed';
  count: number;
  targetCount: number;
  message?: string;
  currentItem?: ContentItem | null;
  items?: ContentItem[];
}

export type ExtensionMessage =
  | { type: 'DETECT_PAGE' }
  | { type: 'PAGE_DETECTED'; payload: { page: PageProfile | null; mode: 'posts' | 'reels' | 'unsupported' } }
  | { type: 'START_SCRAPE'; payload: ScrapeOptions }
  | { type: 'PAUSE_SCRAPE' }
  | { type: 'RESUME_SCRAPE' }
  | { type: 'CANCEL_SCRAPE' }
  | { type: 'SCRAPE_PROGRESS'; payload: ScrapeProgress }
  | { type: 'SCRAPE_RESULT'; payload: ContentItem[] }
  | { type: 'GET_STATE' }
  | { type: 'STATE_UPDATE'; payload: ScrapeProgress };
