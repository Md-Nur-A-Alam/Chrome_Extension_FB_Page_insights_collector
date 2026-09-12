# FB Data Collector by NUR

<p align="center">
  <strong>Production-Grade Chrome Extension for Facebook Page Posts & Reels Analytics</strong><br>
  <em>Automated data harvesting, humanized scrolling, intelligent two-phase Reels player enrichment, multilingual parsing, and an ambient dark-mode dashboard with column visibility controls and complete CRUD management.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue.svg" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Version-1.1.0-emerald.svg" alt="Version 1.1.0">
  <img src="https://img.shields.io/badge/Platform-Chrome%20%7C%20Edge%20%7C%20Brave-indigo.svg" alt="Platform">
  <img src="https://img.shields.io/badge/Language-JavaScript%20%7C%20TypeScript-yellow.svg" alt="Languages">
  <img src="https://img.shields.io/badge/Tests-52%20Passing-brightgreen.svg" alt="Unit Tests">
  <img src="https://img.shields.io/badge/License-MIT-purple.svg" alt="License">
</p>

---

## 📖 Table of Contents
1. [Overview](#-overview)
2. [Objective](#-objective)
3. [Key Features](#-key-features)
   - [Automated Harvesting Engine](#1-automated-harvesting-engine)
   - [Reels Metric Hierarchy Validation](#2-reels-metric-hierarchy-validation)
   - [Multilingual & Bengali (বাংলা) Normalizer](#3-multilingual--bengali-বাংলা-normalizer)
   - [Clean Permalinks & Tracker Stripping](#4-clean-permalinks--tracker-stripping)
   - [Analytics Dashboard & Column Visibility](#5-analytics-dashboard--column-visibility)
   - [Full CRUD Data Management](#6-full-crud-data-management)
   - [Export & Clipboard Utilities](#7-export--clipboard-utilities)
4. [Data Schema Reference](#-data-schema-reference)
5. [Project Architecture](#-project-architecture)
6. [Installation Guide](#-installation-guide)
7. [Instruction Manual (User Guide)](#-instruction-manual-user-guide)
   - [Step 1: Scraping Timeline Posts](#step-1-scraping-timeline-posts)
   - [Step 2: Scraping Facebook Reels (Two-Phase Harvester)](#step-2-scraping-facebook-reels-two-phase-harvester)
   - [Step 3: Navigating the Analytics Dashboard](#step-3-navigating-the-analytics-dashboard)
   - [Step 4: Customizing Column Views](#step-4-customizing-column-views)
   - [Step 5: Performing CRUD Operations](#step-5-performing-crud-operations)
   - [Step 6: Exporting to CSV, JSON, and Sheets](#step-6-exporting-to-csv-json-and-sheets)
8. [Developer & Testing Guide](#-developer--testing-guide)
9. [Troubleshooting & FAQs](#-troubleshooting--faqs)
10. [License & Credits](#-license--credits)

---

## 🌟 Overview

**FB Data Collector by NUR** is a high-performance, client-side Chrome Extension built on Google Chrome's latest **Manifest V3** standard. It automates content collection, engagement analytics, and media performance extraction from Facebook Pages.

Designed for digital marketing teams, growth analysts, social media strategists, and researchers, the extension circumvents tedious manual data entry and avoids fragile Graph API permission gates. It operates directly within your authenticated browser session to harvest public Facebook Posts, Videos, and Reels while strictly adhering to safety limits and humanized interaction cadences.

The platform pairs an automated DOM scraping core with an enterprise-grade, dark-mode glassmorphic dashboard. Users can inspect live metrics, toggle column views, perform instant search filtering across multilingual datasets, execute full Create-Read-Update-Delete (CRUD) actions on harvested entries, and export clean, Excel-ready datasets.

---

## 🎯 Objective

1. **Eliminate Manual Data Entry**: Automatically scrape complete post captions, clean permalinks, author names, publication timestamps, video durations, and granular engagement counts (views, reactions, comments, shares).
2. **Conquer Single-Page Application (SPA) Virtualization**: Seamlessly navigate Facebook's lazy-loading, DOM-recycling feed using an automated **Two-Phase Grid & Player Harvester** for Reels.
3. **Enforce Absolute Data Integrity**: Apply real-time mathematical validation rules to eliminate Facebook DOM artifacts (such as suggestion toolbar reaction counts or unrendered metrics).
4. **Deliver Native Multilingual Fidelity**: Fully support Bengali script (`বাংলা`), English, and Unicode emojis without garbled encoding or mismatched numerical abbreviations.
5. **Empower Data Strategy with In-Browser CRUD**: Provide an interactive workspace to view, edit, delete, manually augment, filter, and export content analytics without external databases.

---

## ✨ Key Features

### 1. Automated Harvesting Engine
* **Timeline Posts Scraper**: Iterates through Facebook Page timelines, dynamically expands `...See more` / `আরও দেখুন` truncated text, extracts author avatars and names, standardizes timestamps, parses reactions, comments, and shares, and extracts canonical post permalinks.
* **Two-Phase Reels Harvester**:
  - **Phase 1 (Grid Scan)**: Smoothly scrolls the Page Reels tab, indexing all visible reel thumbnails, caching thumbnail play/view counts, and recording target player links.
  - **Phase 2 (In-Player Enrichment)**: Programmatically enters each reel player view, mutes audio for silent operation, extracts high-precision reaction, comment, and share tallies directly from the player toolbar, calculates exact video durations, records author details, and transitions smoothly back to the grid.
* **Humanized Navigation Algorithms**: Employs variable scroll steps with randomized pause intervals ($1000\,\text{ms} - 2200\,\text{ms}$) to simulate genuine user browsing and mitigate rate limits.

```
Two-Phase Reels Harvester:
┌──────────────────────────────────────────────────────────┐
│  Phase 1: Grid Scan                                      │
│  [Reel 1 Tile] ───> [Reel 2 Tile] ───> [Reel 3 Tile]     │
│  Extract: Thumbnail Views & Links                        │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│  Phase 2: In-Player Enrichment                           │
│  [Open Player Modal] ──> [Mute Audio] ──> [Read Metrics] │
│  Extract: Full Caption, Unrounded Reactions, Comments,   │
│           Shares, Video Duration (MM:SS)                 │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│  Metric Hierarchy Enforcement & Local Storage Sync       │
└──────────────────────────────────────────────────────────┘
```

---

### 2. Reels Metric Hierarchy Validation
To ensure that Facebook's recommendation bars, suggested reels overlays, or unrendered counts never contaminate your datasets, the harvester enforces a strict mathematical hierarchy at the moment of capture, storage, and manual editing:

$$\mathbf{Views \ge Reactions \ge Comments \ge Shares}$$

* **Rule 1**: If $\text{Views} < \text{Reactions}$, then $\text{Reactions} = 0$.
* **Rule 2**: If $\text{Reactions} < \text{Comments}$, then $\text{Comments} = 0$.
* **Rule 3**: If $\text{Comments} < \text{Shares}$, then $\text{Shares} = 0$.
* **Cascading Zero-Out**: If an upper metric is invalidated (e.g. an unrendered view count results in $\text{Views} = 0$), all downstream subordinate metrics cascade to 0, ensuring consistent data cleanliness.

---

### 3. Multilingual & Bengali (বাংলা) Normalizer
* **Bengali Digit Conversion**: Converts Bengali numerals (`০, ১, ২, ৩, ৪, ৫, ৬, ৭, ৮, ৯`) to standard Hindu-Arabic digits (`0–9`).
* **Bangla Metric Multipliers**: Recognizes and accurately scales Bengali abbreviations:
  - `হাজার` $\rightarrow \times 1,000$
  - `লাখ` $\rightarrow \times 100,000$
  - `কোটি` $\rightarrow \times 10,000,000$
* **Western Metric Multipliers**: Normalizes `K` ($\times 10^3$), `M` ($\times 10^6$), and `B` ($\times 10^9$) alongside European decimal comma formats (e.g., `1,5K` $\rightarrow 1,500$).
* **Bangla Relative Time Parsing**: Accurately standardizes relative dates like `২ ঘণ্টা আগে` (2 hours ago) or `গতকাল` (Yesterday) into ISO-compatible timestamps.

---

### 4. Clean Permalinks & Tracker Stripping
* Automatically strips Facebook marketing and session trackers:
  - `?mibextid=...`, `&__tn__=...`, `fbclid=...`, `ref=...`, `notif_t=...`
* Converts volatile vanity links into stable canonical formats:
  - `https://www.facebook.com/{page}/posts/{pfbid...}`
  - `https://www.facebook.com/reel/{reel_id}`

---

### 5. Analytics Dashboard & Column Visibility
* **Executive Summary Stat Cards**: Real-time totals for Harvested Records (with Posts vs. Reels breakdown), Total Video Views, Total Reactions, Total Comments, and Total Shares.
* **Flexible View Modes**: Switch seamlessly between a high-density **Data Table** and a responsive **Card Grid**.
* **Interactive Column Selector**:
  - Click the **Columns** button to toggle any of the 11 columns via individual checkboxes:
    `# (Index)`, `Type`, `Share Link`, `Author`, `Date`, `Caption`, `Views`, `Reactions`, `Comments`, `Shares`, `Actions`.
  - Includes **"All"** and **"Reset"** convenience shortcuts.
  - Preferences persist automatically in browser `localStorage` (`fb_visible_columns`).
* **Full-Text Live Search**: Filter instantaneously across captions, post links, author handles, and dates with complete Bengali and emoji matching.
* **Multi-Criteria Sorting**: Sort by Newest Date, Oldest Date, Reactions (High to Low), Comments, Shares, Views, or Duration.

---

### 6. Full CRUD Data Management
* **Create (C)**: Click **"+ Add Record"** to manually insert posts or reels. Features full modal validation and automatic Reels metric hierarchy enforcement.
* **Read (R)**: Browse records in the table/grid, or click the **View (👁️)** button to inspect full captions, clickable links, video lengths, and metric breakdowns in a modal dialog.
* **Update (U)**: Click the **Edit (✏️)** button to modify captions, author details, dates, URLs, or metric counts. Updates instantly persist to `chrome.storage.local`.
* **Delete (D)**: Click the **Delete (🗑️)** button to remove entries. A safeguard modal previews the item to prevent accidental deletion.

---

### 7. Export & Clipboard Utilities
* **UTF-8 BOM CSV Export**: Injects a Byte Order Mark (`\uFEFF`) so Microsoft Excel and Google Sheets open Bengali text and emojis without question marks or character corruption.
* **JSON Export**: Generates clean, indented `.json` files ideal for programmatic analytics pipelines.
* **Copy All (TSV)**: Copies all currently filtered rows to the system clipboard as a Tab-Separated Values table. You can paste directly (`Ctrl + V`) into any Google Sheet or Excel workbook.

---

## 📊 Data Schema Reference

Each collected entry adheres to the following data schema:

| Field Name | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Unique identifier (derived from URL or timestamp) | `"post_1710234567890"` |
| `type` | `string` | Content classification: `'post'`, `'reel'`, or `'video'` | `"reel"` |
| `url` | `string` | Canonical shareable URL (trackers stripped) | `"https://www.facebook.com/reel/123456789"` |
| `author` | `string` | Name of the Facebook Page or author | `"Pedago Academy"` |
| `date` | `string` | Human-readable publication date | `"March 12, 2026"` |
| `duration` | `string` | Video duration in `MM:SS` or `HH:MM:SS` (or `""` for posts) | `"01:24"` |
| `caption` | `string` | Full un-truncated post or reel description text | `"নতুন টিউটোরিয়াল দেখুন... 🔥"` |
| `views` | `number` | Total play or view count | `15400` |
| `reactions`| `number` | Total reaction count (Likes, Loves, etc.) | `1250` |
| `comments` | `number` | Total comment count | `320` |
| `shares` | `number` | Total share count | `85` |
| `timestamp`| `number` | Unix epoch time in milliseconds when scraped/created | `1773305400000` |

---

## 🏗️ Project Architecture

```
antigravity/
├── manifest.json                  # Manifest V3 Extension Configuration
├── background.js                  # Background Service Worker (lifecycle & storage)
│
├── content/                       # Content Scripts Injected into Facebook Tabs
│   ├── content.js                 # Bridge coordinator & runtime message router
│   ├── extractor-posts.js         # Timeline posts DOM scraping engine
│   ├── extractor-reels.js         # Two-phase Reels harvester & metric validator
│   └── scroll-manager.js          # Humanized scroll simulation & queue processor
│
├── dashboard/                     # In-Tab Enterprise Analytics Dashboard
│   ├── dashboard.html             # Layout, modals, stat cards, toolbar & table
│   ├── dashboard.css              # Dark-mode glassmorphism styles & responsive layout
│   └── dashboard.js               # State store, column toggler, CRUD engine & exporter
│
├── popup/                         # Browser Action Popup
│   ├── popup.html                 # Scraper trigger interface & item count selector
│   ├── popup.css                  # Modern dark popup theme
│   └── popup.js                   # Popup controller & scraper state synchronization
│
├── utils/                         # Shared Utilities
│   ├── parser.js                  # Multilingual number normalizer & URL sanitizers
│   └── exporter.js                # CSV (UTF-8 BOM), JSON, and Clipboard TSV generators
│
├── src/                           # TypeScript Source Files (Architecture & Types)
│   ├── content/parsers/           # Modular parsers (post-parser, reel-parser)
│   └── types/                     # Shared TypeScript interfaces & types
│
├── tests/                         # Automated Unit Tests (Vitest)
│   ├── unit/reel-extraction-isolation.test.ts # Metric hierarchy validation tests
│   ├── unit/dashboard-crud.test.ts            # CRUD operations & column state tests
│   ├── unit/number-normalizer.test.ts         # Bengali & English number tests
│   ├── unit/post-parser.test.ts               # Post DOM extraction tests
│   └── unit/url-sanitizer.test.ts             # Tracking parameter removal tests
│
├── vite.config.ts                 # Production bundler configuration
└── package.json                   # Dependencies, scripts, and build tasks
```

---

## 🚀 Installation Guide

### Prerequisites
* **Browser**: Google Chrome, Microsoft Edge, Brave, Opera, or any Chromium-based browser.
* **Node.js (Optional, for developers)**: Node.js v18+ and npm (for running automated tests or builds).

### Step-by-Step Installation (Developer Mode)

1. **Download or Clone the Repository**:
   ```bash
   git clone https://github.com/Md-Nur-A-Alam/Chrome_Extension_FB_Page_insights_collector.git
   ```
   *(Or download the ZIP archive and extract it to a local folder).*

2. **Open Chrome Extensions Manager**:
   - In Google Chrome, open a new tab and navigate to:
     ```
     chrome://extensions
     ```

3. **Enable Developer Mode**:
   - In the top-right corner of the Extensions page, switch the **Developer mode** toggle to **ON**.

4. **Load the Unpacked Extension**:
   - Click the **"Load unpacked"** button in the top-left toolbar.
   - Select the project folder:
     `d:\BlackPuzzle\Chrome extension\fb-content-collector\antigravity`
   - Click **Select Folder**.

5. **Pin the Extension**:
   - Click the Extension puzzle icon in Chrome's top toolbar.
   - Find **FB data collector by NUR** and click the pin icon to keep it visible.

---

## 📋 Instruction Manual (User Guide)

### Step 1: Scraping Timeline Posts
1. Open Google Chrome and navigate to the target Facebook Page timeline:
   - Example: `https://www.facebook.com/pedagoacademy`
2. Click the **FB data collector by NUR** extension icon in your Chrome toolbar.
3. In the popup window:
   - Choose your target collection count (e.g. `25`, `50`, or `100`).
   - Click the green **"Start Collecting"** button.
4. The extension will automatically scroll through the page feed, expand `...See more` buttons, and harvest post metrics.
5. The popup shows real-time progress. Click **"Stop"** at any time to pause or finish early.

---

### Step 2: Scraping Facebook Reels (Two-Phase Harvester)
1. Navigate to the Page's Reels tab:
   - Example: `https://www.facebook.com/pedagoacademy/reels/`
2. Open the extension popup and click **"Start Collecting"**.
3. **Phase 1 (Grid Scan)**:
   - The harvester scrolls the grid, indexing reel cards and thumbnail view counts.
4. **Phase 2 (In-Player Enrichment)**:
   - The harvester automatically opens each reel in the player, mutes audio, captures exact reaction, comment, and share counts, records video duration, applies the metric hierarchy rules, and returns to the grid.
5. Once complete, a notification will inform you that all reels have been successfully enriched.

---

### Step 3: Navigating the Analytics Dashboard
1. Open the dashboard by clicking **"Open Dashboard"** in the popup, or right-click the extension icon and select **"Options"**.
2. **Review Key Performance Indicators**:
   - **Total Harvested**: Overall count with Posts and Reels breakdowns.
   - **Total Views**: Sum of all video and reel views.
   - **Total Reactions**: Aggregate likes and reactions.
   - **Total Comments**: Total user discussions.
   - **Total Shares**: Viral distribution count.
3. **Switch Views**: Use the view toggle buttons to switch between **Table View** and **Card Grid View**.
4. **Search**: Type any keyword, author name, or link in the search bar. Supports Bengali (`বাংলা`) and emojis.
5. **Sort**: Use the sort dropdown to arrange data by Newest Date, Reactions, Comments, Shares, Views, or Duration.

---

### Step 4: Customizing Column Views
1. On the dashboard toolbar, click the **"Columns"** button.
2. A dropdown menu appears displaying checkboxes for all 11 columns:
   - `# (Index)`
   - `Type`
   - `Share Link`
   - `Author`
   - `Date`
   - `Caption`
   - `Views`
   - `Reactions`
   - `Comments`
   - `Shares`
   - `Actions`
3. Check or uncheck any column to fit your screen. Unchecked columns are immediately hidden.
4. Use **"All"** to reveal all columns or **"Reset"** to restore default settings.
5. Your choices are automatically remembered on future visits.

---

### Step 5: Performing CRUD Operations

```
Dashboard CRUD Lifecycle:
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   Create (C)    │       │    Read (R)     │       │   Update (U)    │
│  + Add Record   │       │  View Modal 👁️  │       │  Edit Modal ✏️   │
│  Validates &    │       │  Inspect & Copy │       │  Enforces Rules │
│  Enforces Rules │       │  Full Text/Link │       │  & Re-evaluates │
└────────┬────────┘       └────────┬────────┘       └────────┬────────┘
         │                         │                         │
         └─────────────────────────┼─────────────────────────┘
                                   │
                                   ▼
                        ┌─────────────────────┐
                        │     Delete (D)      │
                        │  Delete Modal 🗑️     │
                        │  Safeguard Confirm  │
                        └─────────────────────┘
```

#### Add a Record (Create)
1. Click the **"+ Add Record"** button in the top navbar.
2. Select the content type (`Post`, `Reel`, or `Video`).
3. Fill in the URL, Author, Date, Duration, Caption, and metrics.
4. Click **"Save Record"**. (For Reels, the metric hierarchy rules will be automatically enforced).

#### View Content Details (Read)
1. In the table or card grid, click the **View (👁️)** icon on any row.
2. A modal displays the complete un-truncated caption, author, publication date, video length, and metrics.
3. Use the one-click copy buttons to copy the full caption or URL directly to your clipboard.

#### Edit a Record (Update)
1. Click the **Edit (✏️)** icon on any table row or card.
2. Update any field (caption, link, author, duration, views, reactions, comments, shares).
3. Click **"Save Record"**. The table and overview stat cards update immediately.

#### Delete a Record (Delete)
1. Click the **Delete (🗑️)** trash icon on any row.
2. A confirmation modal displays the item's details.
3. Click **"Yes, Delete Record"** to permanently remove it from storage.

---

### Step 6: Exporting to CSV, JSON, and Sheets
* **Export CSV**: Click **"Export CSV"** to download an Excel-friendly CSV file. It includes a UTF-8 BOM (`\uFEFF`) to ensure Bengali script and emojis display cleanly in Excel.
* **Export JSON**: Click **"JSON"** to download a structured `.json` data file for programmatic analysis.
* **Copy All (Clipboard TSV)**: Click **"Copy All"** to copy the filtered table to your clipboard. Then open Google Sheets or Microsoft Excel and press `Ctrl + V`.

---

## 🧪 Developer & Testing Guide

### Running Automated Tests
The project includes a comprehensive test suite with 52 unit tests executed via **Vitest**.

> [!TIP]
> On Windows PowerShell, execute commands using `npm.cmd` if your system execution policy restricts `.ps1` scripts:

```bash
# Run all unit tests once
npm.cmd test

# Run tests in interactive watch mode
npm.cmd run test:watch
```

### Test Coverage Areas
1. **Reels Metric Consistency (`reel-extraction-isolation.test.ts`)**:
   - Verifies Rule 1 (`Views < Reactions → Reactions = 0`).
   - Verifies Rule 2 (`Reactions < Comments → Comments = 0`).
   - Verifies Rule 3 (`Comments < Shares → Shares = 0`).
   - Verifies cascading zero-out behavior.
2. **Dashboard CRUD & Column Logic (`dashboard-crud.test.ts`)**:
   - Tests Create, Read, Update, and Delete operations.
   - Tests `localStorage` column visibility caching and persistence.
3. **Number & Multilingual Normalizer (`number-normalizer.test.ts`)**:
   - Tests Bengali digit parsing, crore/lakh/thousand multipliers, and western suffixes (`K`, `M`, `B`).
4. **URL Sanitization (`url-sanitizer.test.ts`)**:
   - Tests tracking parameter stripping and canonical link formation.

### Production Build
```bash
# Build production bundle
npm.cmd run build
```

---

## 🛠️ Troubleshooting & FAQs

#### Q: The popup displays "Facebook Tab Required".
**A**: Make sure you have an active browser tab navigated to Facebook (`https://www.facebook.com/...`) before clicking the extension popup.

#### Q: Why are a Reel's reactions or comments set to 0?
**A**: This is intentional behavior governed by the **Reels Metric Hierarchy Validation**. If Facebook's DOM reports a view count of 50, but an internal overlay displays 100 reactions, the extension identifies the 100 reactions as a suggestion button artifact and resets it to 0 (`Views < Reactions → Reactions = 0`).

#### Q: How are Bengali captions and emojis handled in exported CSVs?
**A**: The export engine injects a UTF-8 Byte Order Mark (`\uFEFF`) at the beginning of the file. This forces Microsoft Excel, Google Sheets, and LibreOffice Calc to open the file with UTF-8 encoding, preventing broken characters.

#### Q: Does this extension require a Facebook API token or login credentials?
**A**: No. The extension runs entirely client-side within your browser, utilizing your existing active session without requiring developer app registrations or Graph API credentials.

---

## 📄 License & Credits

Distributed under the **MIT License**. Free for personal, academic, and commercial use.

<p align="center">
  Crafted with ❤️ by <strong>Md. Nur-A-Alam</strong>
</p>
