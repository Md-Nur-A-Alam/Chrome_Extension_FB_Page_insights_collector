# Product Roadmap: Facebook Page Analytics Extension

## 1. Version 1.0.0 (Current Release Scope)

### Core Collection & Extraction
- [x] Manifest V3 compliant Chrome Extension architecture.
- [x] Dual scraping engines:
  - **Posts Engine**: Incremental timeline scanning with action toolbar boundary separation.
  - **Reels Engine**: Two-Phase architecture (Phase 1 Grid Scan + Phase 2 Sequential Player Walkthrough).
- [x] Full caption extraction with auto-expansion of "See more" and strict comment blacklisting.
- [x] Formatted video duration (`45 sec`, `3 min 5 sec`, `30 min 43 sec`).
- [x] Relative published date normalization (`5hr ago`, `3 days ago`, `2 month ago`, and Bengali equivalents).
- [x] Relay JSON store parser for exact integer reactions, comments, shares, views, and creation timestamps.
- [x] Robust number normalization supporting commas, `K`, `M`, `B`, and Bengali numerals (`লাখ`, `কোটি`).

### Analytics & Performance
- [x] Age-normalized velocities: `viewsPerHour` and `engagementPerHour`.
- [x] Comparative baseline engine (deviation from 20-item historical average of same content type).
- [x] Configurable weighted performance scores (Reels vs Posts).
- [x] Directional indicators (`up`, `down`, `neutral`) and qualitative badges (`Excellent`, `Average`, `Poor`).

### Storage & Repository
- [x] Client-side IndexedDB (`FacebookAnalyticsDB`) with automatic schema versioning.
- [x] Non-destructive performance snapshots for tracking growth over multiple scrapes.
- [x] Full scrape session audit history.

### User Interfaces
- [x] **Chrome Side Panel**: Active companion panel alongside Facebook tabs for real-time monitoring and quick actions.
- [x] **Extension Popup**: Compact launcher with page detection, target count controls, and status display.
- [x] **Analytics Dashboard**: Full-tab SaaS dashboard with summary stat cards, charts, searchable/sortable content tables, and session logs.

### Export & Diagnostics
- [x] CSV export (UTF-8 BOM compliant for flawless Excel display of emojis and Bengali).
- [x] Formatted JSON export.
- [x] Multi-tab XLSX export (Summary, Posts, Reels, Performance, History).
- [x] Diagnostics & Troubleshooting screen for self-serve debugging.

---

## 2. Version 2.0.0 (Future Modules)

### 2.1 Multi-Page & Competitor Benchmarking
* Track multiple Facebook Pages concurrently.
* Side-by-side competitor comparison charts (Engagement Rate vs Output Volume).
* Industry benchmark percentile scoring.

### 2.2 Cloud Synchronization & API Backend
* Implementation of `ApiRepository` implementing `DataRepository` interface.
* Cloud sync for cross-device access and team collaboration.
* Webhook integrations (e.g. notify Slack/Discord when a new reel is published).

### 2.3 Advanced Content Intelligence
* **Best Posting Time Heatmap**: Cross-correlating publish hours against engagement velocity.
* **Hashtag Analytics**: Isolating top-performing hashtags and keyword clusters.
* **Optimal Video Length Finder**: Segmenting reel performance by duration bins (<30s, 30-60s, >60s).
* Direct Google Sheets API export integration.
