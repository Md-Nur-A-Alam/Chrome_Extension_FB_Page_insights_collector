# System Architecture: Facebook Page Posts & Reels Analytics Chrome Extension

## 1. Executive Summary & Philosophy
The **Facebook Page Posts & Reels Analytics Chrome Extension** is an enterprise-grade, production-oriented client-side analytics application built using **Manifest V3**, **React 18**, **TypeScript (Strict Mode)**, **Vite**, and **IndexedDB**.

The core engineering principle is **strict modular decoupling**:
```
Facebook Web DOM / Embedded Relay State
                 ↓
            [DETECTORS]   (Confidence scoring, Content type identification)
                 ↓
             [PARSERS]    (Isolated, strategy-based data extraction)
                 ↓
           [NORMALIZERS]  (Social numbers, dates, durations, clean URLs)
                 ↓
           [VALIDATORS]   (Integrity checks, required fields, partial/complete flags)
                 ↓
       [MESSAGE ROUTER / BUS] (Strongly typed MV3 IPC via chrome.runtime)
                 ↓
        [DATA REPOSITORY] (IndexedDB with non-destructive versioned snapshots)
                 ↓
       [ANALYTICS ENGINE] (Age-normalized velocity, weighted scoring, baselines)
                 ↓
     [PRESENTATION & EXPORT] (Side Panel, Popup, Full Dashboard, CSV/JSON/XLSX)
```

Because Facebook's DOM is dynamic and frequently updated, all selector strings are strictly isolated in `src/content/selectors/`. Any UI changes from Facebook only require updating parser/selector modules without rewriting data models, database schemas, analytics engines, or UI components.

---

## 2. Chrome Extension Manifest V3 Architecture

### 2.1 Background Service Worker (`src/background/`)
* **`service-worker.ts`**: Entry point for the MV3 service worker. Manages lifecycle events (`onInstalled`, `onStartup`), registers Side Panel behavior, and coordinates background tasks.
* **`message-router.ts`**: Centralized, strongly-typed message hub. Routes actions between Content Scripts, Popup, Side Panel, and Dashboard tabs without arbitrary unvalidated messages.
* **`scrape-manager.ts`**: Orchestrates long-running scrape sessions across tab navigations, tracks timeouts, maintains session state in `chrome.storage.session`, and handles graceful cancellation via `AbortController`.

### 2.2 Content Script Layer (`src/content/`)
* **`facebook-content.ts`**: Primary content script injected on `*://*.facebook.com/*`. Initializes message listeners and acts as a bridge between the browser window and extraction submodules.
* **`page-detector.ts`**: Identifies whether the active tab is a valid Facebook Page, Page Posts tab, Page Reels tab, standalone Post, or standalone Reel.
* **`scanner.ts`**: Coordinates DOM element discovery, maintains deduplication caches in memory, and triggers detectors.
* **`scroll-manager.ts`**: Provides smooth, human-like incremental scrolling with configurable delays, maximum items cap, and adaptive idle detection.
* **Detectors (`src/content/detectors/`)**:
  * `post-detector.ts`: Identifies timeline post cards, calculates detection confidence (`0.0` - `1.0`).
  * `reel-detector.ts`: Identifies reel items (both grid cards and standalone reel players).
  * `media-detector.ts`: Identifies video elements, image galleries, carousels, and external link previews.
* **Parsers (`src/content/parsers/`)**:
  * Independent parser classes implementing the `IParser<T>` contract:
    * `canParse(element: Element): boolean`
    * `parse(element: Element): Partial<T>`
    * `getConfidence(element: Element): number`
  * Separate modules for reactions, comments, shares, views, dates, captions, and durations.
* **Selector Registry (`src/content/selectors/`)**:
  * Single source of truth for all CSS, XPath, and attribute selectors. Grouped by layout version and feature.

### 2.3 User Interface Layer (`src/popup/`, `src/sidepanel/`, `src/dashboard/`)
* **Popup (`src/popup/`)**: Quick-action launcher. Displays active Page name, quick scrape controls, session status, and links to the Side Panel and Dashboard.
* **Side Panel (`src/sidepanel/`)**: Primary active workspace during Facebook browsing. Uses the Chrome `sidePanel` API (`chrome.sidePanel`) to display real-time scraping progress, live stream of extracted posts/reels, quick filters, and mini-analytics alongside the Facebook tab.
* **Dashboard (`src/dashboard/`)**: Full-tab analytics suite (`chrome-extension://<id>/dashboard.html`). Includes comprehensive summary cards, interactive charts, sortable/filterable tables, export utilities, and historical session logs.

---

## 3. Data Storage & Repository Pattern

### 3.1 IndexedDB (`src/database/indexed-db.ts`)
Large datasets are stored in client-side IndexedDB (`FacebookAnalyticsDB`, versioned with migration support).
Stores include:
1. `pages`: Metadata about scraped Facebook pages (Page ID, name, handle, avatar, verified badge).
2. `contents`: Core table storing unified `BaseContent`, `PostContent`, and `ReelContent` entities.
3. `performance_snapshots`: Historical time-series metrics (`views`, `reactions`, `comments`, `shares`, `scrapedAt`) for tracking growth over time.
4. `scrape_sessions`: Audit trail of every scraping run (started, completed, items found, errors, duration).
5. `settings`: User preferences (weights, scroll speed, default views).
6. `errors`: Diagnostic logs of parsing warnings and runtime exceptions.

### 3.2 Repository Abstraction (`src/database/repositories/`)
An explicit repository pattern (`ContentRepository`, `PageRepository`, `SessionRepository`) isolates database operations. This architecture allows effortless future extension to a cloud API backend without modifying UI or scraper code.

---

## 4. Performance & Analytics Subsystem (`src/analytics/`)
* **`engagement.ts`**: Computes total engagement (`reactions + comments + shares`) and engagement rates. Strictly maintains `null` if requisite fields are unexposed in the UI.
* **`velocity.ts`**: Computes time-normalized velocities (`viewsPerHour = views / max(ageHours, 1)`).
* **`performance.ts`**: Computes deviation from historical baselines:
  $$\text{performancePercent} = \frac{\text{currentMetric} - \text{baselineMetric}}{\text{baselineMetric}} \times 100$$
* **`statistics.ts`**: Provides automated descriptive statistics (median, mean, top performing content, content format comparisons) without external AI dependencies.

---

## 5. Export Subsystem (`src/export/`)
* **`csv-export.ts`**: RFC 4180 compliant CSV generator with UTF-8 BOM (`\uFEFF`) for perfect display of multilingual text (English, Bengali, emojis) in Excel.
* **`json-export.ts`**: Formatted JSON data exporter for data engineers and external BI ingestion.
* **`xlsx-export.ts`**: Multi-tab Excel workbook generator (`Summary`, `Posts`, `Reels`, `Performance`, `History`) with frozen headers, formatted percentages, auto-sized columns, and styled header rows.

---

## 6. Security, Compliance & Ethical Boundaries
1. **No Authentication Bypass**: The extension operates purely within the authenticated session established by the human user in their Chrome browser.
2. **No Stealth Anti-Bot Evasion**: No CAPTCHA circumvention, browser fingerprint spoofing, or headless stealth injection.
3. **Conservative Scraping Delays**: Human-like pacing with randomized pauses (1.5s - 3.5s) to avoid client or network overload.
4. **Strict CSP & Security**: Manifest V3 compliant. Zero `eval()`, zero `new Function()`, zero remote code execution. All UI rendering uses React JSX with automatic HTML entity escaping.
