# Limitations & Realistic UI Extraction: Facebook Page Analytics Extension

## 1. Ground Truth: Realistic UI Extraction Boundary
The extension strictly adheres to the principle of **extracting only legitimately visible data** through Facebook's desktop web interface.

| Data Field | Availability in Facebook UI | Extraction Feasibility | Fallback / Behavior if Missing |
| :--- | :--- | :--- | :--- |
| **Reel Views** | Visible on Page Reels Grid thumbnail badges & video player info | 100% Reliable | Phase 1 captures views from grid; preserved throughout Phase 2. |
| **Post Views** | Available only on specific video posts (not standard image/text posts) | Conditional | Returns `null` for text/image posts; does NOT fabricate 0. |
| **Reactions** | Visible on Action Bar & summary row | 100% (unless creator disabled) | If creator hid counts, returns `null` with warning. |
| **Comments** | Visible on Action Bar & comments drawer | 100% (unless creator disabled) | If comments turned off, returns `0` or `null`. |
| **Shares** | Visible on Action Bar & summary row | 90% (some reels hide shares if 0) | Returns `0` if confirmed zero, `null` if unexposed. |
| **Video Duration** | Available via Relay store, HTML5 `<video>`, and player seekbar | 100% for Reels/Videos | Formatted to `X min Y sec` (e.g. `3 min 5 sec`). Returns `'N/A'` for text/image posts. |
| **Published Date** | Visible as relative string (e.g. `5h`, `3d`, `2m`) and in `article:published_time` metadata | 100% | Normalized to relative time length (`5hr ago`, `3 days ago`). Exact ISO timestamp preserved when metadata present. |
| **Caption** | Visible in post body / reel description | 100% | Auto-expands "See more"; blacklists comments section. |
| **Media Attachments** | Thumbnail, video stream, image URLs | 100% (public CDN URLs) | Stores stable CDN URLs; does not re-download raw files. |
| **Author Info** | Page name, handle, verified badge, avatar | 100% | Captured at page level and attached to all content items. |

---

## 2. Intentionally Excluded Metrics (Private Meta Graph API Only)
The following metrics **cannot** be obtained via public DOM scraping and will **never** be fabricated:
1. **Private Reach & Impressions**: Facebook only exposes reach to authenticated Page Admins via Meta Business Suite.
2. **Audience Retention Curves**: % of video watched, average watch time, drop-off points.
3. **Demographics**: Viewer gender, age distribution, country/city breakdown.
4. **Link Clicks / CTR**: Outbound click counts on external URLs.

---

## 3. Facebook DOM & Technical Constraints

### 3.1 DOM Virtualization
Facebook uses aggressive DOM recycling (virtualization). As the user scrolls down a long feed, DOM nodes above the viewport are removed from memory.
* **Mitigation**: The scraper processes and caches each item into IndexedDB **incrementally as it enters the viewport**, rather than attempting a single massive DOM traversal at the end.

### 3.2 Dynamic Obfuscated CSS Classes
Facebook's build pipeline generates hashed, unstable class names (e.g., `x1lliihq x6ikm8r x10wlt62`).
* **Mitigation**: The extension **never relies on raw CSS class names**. Instead, it utilizes:
  1. Semantic roles (`role="button"`, `role="toolbar"`, `role="article"`).
  2. Persistent accessibility labels (`aria-label*="like" i`, `aria-label*="comment" i`).
  3. Stable data attributes (`data-ad-preview="message"`).
  4. Hierarchical DOM relationships (button container, adjacent span wrapper).
  5. In-page Relay JSON scripts (`script[type="application/json"]`).

### 3.3 Rate Limiting & Account Safety
Aggressive rapid scrolling or opening dozens of tabs concurrently can trigger Facebook's temporary activity warnings.
* **Mitigation**:
  * Paced scrolling (default 1800ms delay).
  * Strict item targets (e.g., 25, 50, 100).
  * Single active tab sequential walkthrough for Reels.
  * Instant pause and cancel controls.
