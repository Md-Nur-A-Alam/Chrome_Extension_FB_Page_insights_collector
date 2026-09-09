# Scraping Strategy: Facebook Posts & Reels Analytics Extension

## 1. Ethical & Technical Principles
1. **Client-Side Legitimacy**: The extension only reads DOM elements and public Relay store payloads legitimately rendered in the user's active browser window.
2. **Zero Injected Stealth**: No anti-bot evasion hacks, CAPTCHA bypasses, or cookie extraction.
3. **Paced, Human-Like Navigation**: Conservative scrolling intervals (1500ms - 3000ms) with jitter to prevent browser tab locking and server throttling.
4. **Strict Truthfulness**: Distinguishes strictly between `null` (data not rendered or hidden by creator), `"loading"`, and `0` (explicitly zero engagement).

---

## 2. Scraping Architecture Overview

```
[Page Detector]
       ↓
Identify Page Context:
  ├─ Page Reels Grid (/reels/ or /videos/)  ──→ [Two-Phase Reels Pipeline]
  └─ Page Timeline (/ or /posts/)           ──→ [Incremental Feed Pipeline]
```

---

## 3. Two-Phase Reels Engine (`src/content/`)

### Phase 1: Pre-Scan & Grid Discovery
* **Target**: `https://www.facebook.com/{page_identifier}/reels/`
* **Mechanism**:
  1. Identifies all reel card anchors: `a[href*="/reel/"]`.
  2. Extracts the Reel ID from the clean URL.
  3. Extracts the visible view count badge from the thumbnail overlay (Facebook renders view counts prominently on grid cards).
  4. Collects the thumbnail poster image URL.
  5. Scrolls incrementally down the grid until `targetCount` unique reels are indexed or the end of the grid is reached.
  6. Stores indexed queue into `chrome.storage.local` with full session state.

### Phase 2: Sequential Player Walkthrough & In-Depth Enrichment
* **Target**: Individual Reel URLs `https://www.facebook.com/reel/{id}/`
* **Mechanism**:
  1. Redirects sequentially to `Reel 1`, `Reel 2`, ..., `Reel N`.
  2. Waits for React DOM mounting and Relay GraphQL store hydration via an **Adaptive Polling Loop** (`waitForMetrics`, 350ms interval, up to 3500ms max).
  3. **Relay JSON Script Extraction (Primary)**:
     - Scans `script[type="application/json"]` for Relay store payloads containing:
       - `reaction_count.count` (exact unrounded integer, e.g. `4,821`).
       - `total_comment_count` / `comment_count.total_count`.
       - `share_count.count`.
       - `playable_duration_in_ms` / `length_in_second`.
       - `creation_time` / `publish_time` (Unix epoch seconds).
  4. **Targeted Action Bar DOM Extraction (Secondary / Fallback)**:
     - Targets the vertical action bar beside the reel video.
     - Case-insensitive queries for button wrappers:
       - Reactions: `[aria-label*="like" i]`, `[aria-label*="reaction" i]`, `[aria-label*="লাইক" i]`.
       - Comments: `[aria-label*="comment" i]`, `[aria-label*="মন্তব্য" i]`.
       - Shares: `[aria-label*="share" i]`, `[aria-label*="শেয়ার" i]`.
     - Inspects both button text and adjacent count container spans (`span[dir="auto"]`).
     - Uses positional fallback (1st: Like, 2nd: Comment, 3rd: Share) if aria labels are obfuscated.
  5. **Video Duration Extraction**:
     - Pulls from Relay `playable_duration_in_ms` $\rightarrow$ HTML5 `<video>.duration` $\rightarrow$ seekbar `div[role="progressbar"]`.
     - Normalizes into human-readable duration (`Parser.formatVideoDuration()`, e.g. `3 min 5 sec`, `30 min 43 sec`).
  6. **Relative Published Date**:
     - Calculates elapsed time from `creation_time` or `meta[property="article:published_time"]` or author timestamp anchors.
     - Formats into clean relative time lengths (`5hr ago`, `3 days ago`, `2 month ago`, and Bengali equivalents).
  7. **Full Caption Extraction**:
     - Expands `...more` / `আরও দেখুন` buttons within the caption container.
     - Strictly blacklists comment containers (`div[role="article"]`, `form`, `ul`) to prevent comment text leaking into post body.
  8. Saves enriched item to IndexedDB, updates progress, and steps to the next queue item.

---

## 4. Incremental Posts Engine (`src/content/`)

### Timeline Discovery & Extraction
* **Target**: `https://www.facebook.com/{page_identifier}/` or `/posts/`
* **Mechanism**:
  1. Identifies post card containers: `div[role="feed"] > div`, `div[role="article"]`, `div[data-ad-preview="message"]`.
  2. Demarcates post content from comments using the **Action Toolbar Boundary** (`div[role="toolbar"]` or reaction icons row). Everything above the toolbar is post body; everything below is comment section.
  3. **Post Link & ID Extraction**:
     - Inspects permalink anchors above the toolbar: `/posts/`, `story_fbid=`, `permalink.php`.
     - Extracts clean post ID (including modern alphanumeric `pfbid0...` hashes).
  4. **Caption Extraction**:
     - Automatically expands `"See more"` / `"আরও দেখুন"` buttons strictly above the toolbar.
     - Reads primary message from `div[data-ad-preview="message"]` or `div[dir="auto"]`.
  5. **Engagement Metrics Extraction**:
     - Inspects the engagement summary row directly above the toolbar:
       - Reactions count from summary pill (`[aria-label*="reaction" i]`).
       - Comment count from `"X comments"` / `"Xটি মন্তব্য"`.
       - Share count from `"X shares"` / `"Xটি শেয়ার"`.
  6. **Media Detection**:
     - Detects image count, video posters, video duration, and external link previews.
  7. **Scroll Manager**:
     - Incremental scroll step (80% viewport height).
     - Deduplicates items using `Set<id>`.
     - Stops when `targetCount` reached or after 8 consecutive scrolls with zero new items.

---

## 5. Deduplication Strategy
To avoid inflating analytics:
1. **Primary Key**: Clean Facebook Content ID (`post_...`, `reel_...`, `pfbid0...`).
2. **Secondary Key**: Normalized permalink URL (stripped of all tracking parameters `__cft__`, `__tn__`, `fbclid`, etc.).
3. **Tertiary Key**: Content Fingerprint hash:
   $$\text{hash} = \text{MD5}(\text{pageId} + \text{caption}_{50} + \text{publishedAt} + \text{mediaType})$$
If an item with an existing ID is re-scraped, the database **updates** the record and writes a new **`PerformanceSnapshot`** row to preserve historical metrics without creating duplicate rows.
