# Testing Plan & Quality Assurance: Facebook Page Analytics Extension

## 1. Quality Objectives
Every release must pass automated unit testing, TypeScript compilation with zero errors under strict mode, ESLint validation, and automated production build checks.

---

## 2. Test Architecture
* **Framework**: Vitest (or Jest) + JSDOM.
* **Coverage Targets**:
  * Parsers & Normalizers: $\ge 95\%$ coverage.
  * Analytics & Velocity: $100\%$ mathematical branch coverage.
  * Database Repositories: $\ge 90\%$ CRUD coverage.
  * Message Router: $100\%$ type contract coverage.

---

## 3. Automated Test Suites (`tests/`)

### 3.1 Parsers & Normalizers (`tests/parsers/`)
1. **`number-parser.test.ts`**:
   * Standard English: `"1K"` $\rightarrow 1,000$; `"2.5K"` $\rightarrow 2,500$; `"1M"` $\rightarrow 1,000,000$; `"2.3M"` $\rightarrow 2,300,000$.
   * Formatting commas: `"1,234"` $\rightarrow 1,234$; `"12,450"` $\rightarrow 12,450$.
   * European decimal commas: `"1,5K"` $\rightarrow 1,500$.
   * Bengali numerals & suffixes: `"১.২ লাখ"` $\rightarrow 120,000$; `"৩ কোটি"` $\rightarrow 30,000,000$; `"৫২টি মন্তব্য"` $\rightarrow 52$.
   * Empty / Invalid / Whitespace: `""` $\rightarrow \text{null}$; `"N/A"` $\rightarrow \text{null}$.
2. **`date-parser.test.ts`**:
   * Relative hours/days: `"2h"`, `"5 hrs"`, `"4d"`, `"1w"`, `"yesterday"`, `"just now"`.
   * Shorthand normalizations: `"5h"` $\rightarrow `"5hr ago"`; `"3d"` $\rightarrow `"3 days ago"`.
   * Bengali phrases: `"৫ ঘণ্টা আগে"`, `"৩ দিন আগে"`, `"২ মাস আগে"`, `"এইমাত্র"`.
   * ISO 8601 timestamps and Unix timestamps $\rightarrow$ relative calculations.
   * Unparseable text preserves original relative string and flags warning without fabricating dates.
3. **`duration-parser.test.ts`**:
   * String to seconds: `"0:37"` $\rightarrow 37$; `"1:05"` $\rightarrow 65$; `"10:42"` $\rightarrow 642$; `"1:02:15"` $\rightarrow 3735$.
   * Seconds to formatted string: `45` $\rightarrow `"45 sec"`; `185` $\rightarrow `"3 min 5 sec"`; `1843` $\rightarrow `"30 min 43 sec"`.

### 3.2 Analytics & Calculations (`tests/analytics/`)
1. **`engagement.test.ts`**:
   * Complete metrics: $100 + 20 + 10 = 130$.
   * Null handling: if shares is `null`, totalEngagement is `null` (never defaults to 0 unless verified).
   * Engagement rate: $(130 / 2000) \times 100 = 6.5\%$.
2. **`velocity.test.ts`**:
   * Zero age protection: ageHours $= 0 \implies \text{uses } \max(0, 1) = 1$, avoiding division by zero.
3. **`performance.test.ts`**:
   * Above baseline: current $150$, baseline $100 \implies +50.0\%$ (`up`, `Excellent`).
   * Below baseline: current $50$, baseline $100 \implies -50.0\%$ (`down`, `Poor`).
   * Insufficient data: $< 5$ baseline items $\implies$ direction `"unknown"`, percent `null`.

### 3.3 HTML Fixtures (`tests/fixtures/`)
The parser suite tests real DOM extraction against saved offline fixtures:
* `tests/fixtures/facebook-post-basic.html`
* `tests/fixtures/facebook-post-image.html`
* `tests/fixtures/facebook-post-video.html`
* `tests/fixtures/facebook-post-missing-share.html`
* `tests/fixtures/facebook-reel-basic.html`
* `tests/fixtures/facebook-reel-missing-views.html`
* `tests/fixtures/facebook-reel-localized-numbers.html`

---

## 4. Manual QA Verification Checklist

### Pre-requisites
- [ ] Build succeeds with `npm run build` producing `dist/`.
- [ ] Load unpacked extension in `chrome://extensions`.
- [ ] Extension icon, popup, and side panel open without CSP or runtime errors.

### Live Scrape Testing Checklist
- [ ] **Target Identification**:
  - Open target Facebook Page (`https://www.facebook.com/<Page>/`).
  - Verify popup detects Page title, handle, and avatar.
- [ ] **Posts Collection**:
  - Set target count to 10 posts.
  - Click "Scrape Posts".
  - Verify scrolling is incremental with visible progress.
  - Verify full caption text expands without including comment bodies.
  - Verify reactions, comments, and shares are non-zero where visible.
  - Verify published date displays relative string (e.g. `2 days ago`).
- [ ] **Reels Collection (Two-Phase)**:
  - Open Page Reels (`https://www.facebook.com/<Page>/reels/`).
  - Set target count to 5 reels.
  - Click "Scrape Reels".
  - Verify Phase 1 pre-scans grid and captures views.
  - Verify Phase 2 visits each reel sequentially:
    - Reactions, comments, shares extracted accurately.
    - Video length formatted cleanly (e.g. `3 min 5 sec`).
    - Published date formatted (e.g. `5hr ago`, `3 days ago`).
    - Phase 1 view counts preserved.
- [ ] **Dashboard Verification**:
  - Open Dashboard tab.
  - Verify summary metric cards (Total Posts, Total Reels, Total Views, Total Engagement).
  - Verify table sorting (Newest, Views, Reactions).
  - Verify search filter filters captions and URLs in real-time.
  - Test CSV, JSON, and XLSX downloads.
  - Inspect exported XLSX: verify frozen headers, sheet separation, and number formatting.
- [ ] **Cancellation & Pause**:
  - Click "Pause" $\rightarrow$ verify scrolling halts and state updates.
  - Click "Resume" $\rightarrow$ verify scraping continues from active item.
  - Click "Cancel" $\rightarrow$ verify already collected items are saved to database.
