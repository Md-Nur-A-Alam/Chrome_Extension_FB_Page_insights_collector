# Data Model Specification: Facebook Page Analytics Extension

## 1. Overview
The data model is designed around strict TypeScript interfaces, ensuring type safety, seamless IndexedDB serialization, and clear distinction between `null` (data unavailable or unexposed by Facebook UI), `"not loaded yet"`, and numeric `0`.

---

## 2. Core Entities

### 2.1 Base Content (`BaseContent`)
Common interface implemented by both Posts and Reels:

```typescript
export type ContentType = 'post' | 'reel';
export type PerformanceDirection = 'up' | 'down' | 'neutral' | 'unknown';
export type ExtractionStatus = 'complete' | 'partial' | 'failed';

export interface BaseContent {
  id: string;                               // Unique identifier (e.g. pfbid0..., numeric ID, or clean hash)
  platform: 'facebook';
  pageId?: string | null;                   // Facebook numeric or vanity page identifier
  pageName?: string | null;                 // Display name of the Facebook Page

  type: ContentType;                        // 'post' | 'reel'

  caption: string | null;                   // Cleaned text body (preserves line breaks & emojis)
  url: string | null;                       // Normalized permalink

  publishedAt: string | null;               // ISO 8601 string (e.g. 2026-09-08T14:30:00.000Z) or null
  publishedRelative: string | null;         // Visible relative text (e.g. "5hr ago", "3 days ago", "৫ ঘণ্টা আগে")
  ageHours: number | null;                  // Computed elapsed hours from publishedAt to scrape timestamp

  scrapedAt: string;                        // ISO 8601 scrape collection timestamp

  // Engagement Metrics (strict null if not exposed in UI)
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  views: number | null;                     // Exposed on Reels grid & certain video posts

  totalEngagement: number | null;           // reactions + comments + shares (null if required parts missing)
  engagementRate: number | null;            // (totalEngagement / views) * 100 or null

  // Computed Velocity Metrics
  viewsPerHour: number | null;              // views / max(ageHours, 1)
  engagementPerHour: number | null;         // totalEngagement / max(ageHours, 1)

  // Comparative Performance Metrics
  performancePercent: number | null;        // Percentage delta against baseline (e.g. +45.2% or -12.4%)
  performanceDirection: PerformanceDirection; // 'up' (> +10%), 'down' (< -10%), 'neutral', 'unknown'
  performanceLabel?: string;                // 'Excellent', 'Above Average', 'Average', 'Below Average', 'Poor'

  // Quality & Diagnostics
  dataQualityScore: number;                 // 0 to 100 percentage
  extractionStatus: ExtractionStatus;       // 'complete' | 'partial' | 'failed'
  extractionWarnings: string[];             // Audit notes (e.g. "Shares hidden by creator", "Date normalized from relative")
  rawFingerprint: string;                   // hash(pageName + caption + publishedAt + media) for deduplication
}
```

---

### 2.2 Reel Content (`ReelContent`)
Extends `BaseContent` with video and reel player specific attributes:

```typescript
export interface ReelContent extends BaseContent {
  type: 'reel';

  durationSeconds: number | null;           // Video length in integer seconds (e.g. 185)
  durationFormatted: string | null;         // Formatted human-readable duration (e.g. "3 min 5 sec")

  thumbnailUrl: string | null;              // Poster image URL
  mediaUrl: string | null;                  // Video source stream URL if available
}
```

---

### 2.3 Post Content (`PostContent`)
Extends `BaseContent` with post format and media attachments:

```typescript
export type PostFormat = 'text' | 'image' | 'video' | 'carousel' | 'link' | 'mixed' | 'unknown';

export interface MediaItem {
  type: 'image' | 'video' | 'link' | 'unknown';
  url: string | null;
  thumbnailUrl?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface PostContent extends BaseContent {
  type: 'post';

  media: MediaItem[];                       // Array of attached media items
  postFormat: PostFormat;                   // Structural classification
  videoDurationSeconds: number | null;      // Duration if post format is video
  videoDurationFormatted: string | null;    // Formatted duration if video post
}
```

---

## 3. Storage & Historical Entities

### 3.1 Page Profile (`PageProfile`)
Information about the target Facebook Page:

```typescript
export interface PageProfile {
  id: string;                               // Unique handle or ID (e.g. "pedagoacademy")
  name: string;                             // Display name ("Pedago Academy")
  url: string;                              // Canonical URL ("https://www.facebook.com/pedagoacademy")
  avatarUrl?: string | null;
  verified: boolean;
  followerCount?: number | null;
  firstScrapedAt: string;
  lastScrapedAt: string;
  totalPostsCollected: number;
  totalReelsCollected: number;
}
```

### 3.2 Performance Snapshot (`PerformanceSnapshot`)
Captures time-series metrics over multiple scrapes of the same content item:

```typescript
export interface PerformanceSnapshot {
  id?: number;                              // Auto-incremented primary key in IndexedDB
  contentId: string;                        // Foreign key referencing BaseContent.id
  pageId: string;                           // Page identifier
  scrapedAt: string;                        // Snapshot timestamp (ISO 8601)

  views: number | null;
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  totalEngagement: number | null;
}
```

### 3.3 Scrape Session Audit Record (`ScrapeSession`)
Tracks execution diagnostics for each scraping run:

```typescript
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
```

---

## 4. Settings Entity (`UserSettings`)

```typescript
export interface UserSettings {
  // Collection controls
  defaultMaxItems: number;                  // Default 50
  scrollDelayMs: number;                    // Default 1800ms
  pageLoadWaitMs: number;                   // Default 2500ms
  defaultContentType: 'posts' | 'reels' | 'both';

  // Performance calculation preferences
  baselineSampleSize: number;               // Default 20
  performanceThresholdPercent: number;      // Default 10.0%
  reelsWeights: {
    viewsWeight: number;                    // Default 0.40 (40%)
    engagementWeight: number;               // Default 0.30 (30%)
    engagementRateWeight: number;           // Default 0.20 (20%)
    sharesWeight: number;                   // Default 0.10 (10%)
  };
  postsWeights: {
    engagementWeight: number;               // Default 0.50 (50%)
    engagementPerHourWeight: number;        // Default 0.30 (30%)
    commentsWeight: number;                 // Default 0.10 (10%)
    sharesWeight: number;                   // Default 0.10 (10%)
  };

  // Export settings
  defaultExportFormat: 'csv' | 'json' | 'xlsx';
  includeMediaUrls: boolean;
  includeUnavailableFields: boolean;

  // Developer & Debug
  debugMode: boolean;
  verboseLogging: boolean;
}
```
