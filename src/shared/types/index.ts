export type ContentType = 'post' | 'reel';
export type PerformanceDirection = 'up' | 'down' | 'neutral' | 'unknown';
export type ExtractionStatus = 'complete' | 'partial' | 'failed';
export type PostFormat = 'text' | 'image' | 'video' | 'carousel' | 'link' | 'mixed' | 'unknown';

export interface BaseContent {
  id: string;
  platform: 'facebook';
  pageId?: string | null;
  pageName?: string | null;

  type: ContentType;

  caption: string | null;
  url: string | null;

  publishedAt: string | null;
  publishedRelative: string | null;
  ageHours: number | null;

  scrapedAt: string;

  reactions: number | null;
  comments: number | null;
  shares: number | null;
  views: number | null;

  totalEngagement: number | null;
  engagementRate: number | null;

  viewsPerHour: number | null;
  engagementPerHour: number | null;

  performancePercent: number | null;
  performanceDirection: PerformanceDirection;
  performanceLabel?: string;

  dataQualityScore: number;
  extractionStatus: ExtractionStatus;
  extractionWarnings: string[];
  rawFingerprint: string;
}

export interface ReelContent extends BaseContent {
  type: 'reel';

  durationSeconds: number | null;
  durationFormatted: string | null;

  thumbnailUrl: string | null;
  mediaUrl: string | null;
}

export interface MediaItem {
  type: 'image' | 'video' | 'link' | 'unknown';
  url: string | null;
  thumbnailUrl?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface PostContent extends BaseContent {
  type: 'post';

  media: MediaItem[];
  postFormat: PostFormat;
  videoDurationSeconds: number | null;
  videoDurationFormatted: string | null;
}

export type ContentItem = ReelContent | PostContent;

export interface PageProfile {
  id: string;
  name: string;
  url: string;
  avatarUrl?: string | null;
  verified: boolean;
  followerCount?: number | null;
  firstScrapedAt: string;
  lastScrapedAt: string;
  totalPostsCollected: number;
  totalReelsCollected: number;
}

export interface PerformanceSnapshot {
  id?: number;
  contentId: string;
  pageId: string;
  scrapedAt: string;

  views: number | null;
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  totalEngagement: number | null;
}

export interface ScrapeSession {
  sessionId: string;
  pageId: string;
  pageName: string;
  pageUrl: string;
  mode: 'posts' | 'reels' | 'both';

  targetCount: number;
  itemsFound: number;
  itemsSaved: number;
  itemsUpdated: number;
  itemsFailed: number;

  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  status: 'running' | 'completed' | 'paused' | 'cancelled' | 'failed';

  errors: Array<{
    code: string;
    message: string;
    contentId?: string;
    timestamp: string;
  }>;
}

export interface UserSettings {
  defaultMaxItems: number;
  scrollDelayMs: number;
  pageLoadWaitMs: number;
  defaultContentType: 'posts' | 'reels' | 'both';

  baselineSampleSize: number;
  performanceThresholdPercent: number;
  reelsWeights: {
    viewsWeight: number;
    engagementWeight: number;
    engagementRateWeight: number;
    sharesWeight: number;
  };
  postsWeights: {
    engagementWeight: number;
    engagementPerHourWeight: number;
    commentsWeight: number;
    sharesWeight: number;
  };

  defaultExportFormat: 'csv' | 'json' | 'xlsx';
  includeMediaUrls: boolean;
  includeUnavailableFields: boolean;

  debugMode: boolean;
  verboseLogging: boolean;
}
