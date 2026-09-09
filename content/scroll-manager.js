/**
 * Scroll & Collection Orchestrator
 * Two-Phase Architecture for Reels:
 * 1. Pre-scans and counts all reels from the page grid up to target count.
 * 2. Opens the newest reel in the Player, matches each reel by ID/URL with the pre-scanned list,
 *    extracts full metrics, and steps down through each reel until all pre-scanned reels are completed.
 */

class ScrollManager {
  constructor() {
    this.status = 'idle'; // 'idle', 'running', 'paused', 'completed', 'stopped'
    this.targetCount = 50;
    this.delayMs = 1500;
    this.mode = 'auto'; // 'auto', 'posts', 'reels'
    this.collectedMap = new Map();
    this.scannedReels = [];
    this.currentReelIndex = 0;
    this.pageAuthorInfo = null;
    this.loopTimer = null;
    this.consecutiveNoNewCount = 0;
    this.maxNoNewThreshold = 8;
    this.isWalkingReels = false;
  }

  /**
   * Starts a collection session
   */
  async start({ targetCount = 50, delayMs = 1500, mode = 'auto' } = {}) {
    this.targetCount = Math.max(1, parseInt(targetCount) || 50);
    this.delayMs = Math.max(800, parseInt(delayMs) || 1500);
    this.mode = mode;
    this.status = 'running';
    this.consecutiveNoNewCount = 0;
    this.currentReelIndex = 0;

    console.log(`[FB-Collector] Starting session: target=${this.targetCount}, mode=${this.mode}`);
    this.broadcastState('Starting collection...');

    const effectiveMode = this.resolveMode();

    if (effectiveMode === 'reels') {
      this.startReelTwoPhaseEngine();
    } else {
      this.startPostCollection();
    }
  }

  /**
   * Pauses active collection
   */
  pause() {
    if (this.status !== 'running') return;
    this.status = 'paused';
    clearTimeout(this.loopTimer);
    console.log('[FB-Collector] Collection paused');
    this.broadcastState('Collection paused');
  }

  /**
   * Resumes paused collection
   */
  resume() {
    if (this.status !== 'paused') return;
    this.status = 'running';
    console.log('[FB-Collector] Collection resumed');
    this.broadcastState('Resuming collection...');

    if (this.resolveMode() === 'reels') {
      this.processNextReel();
    } else {
      this.stepPostCollection();
    }
  }

  /**
   * Stops collection immediately
   */
  async stop() {
    this.status = 'stopped';
    clearTimeout(this.loopTimer);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        fb_reels_queue_active: false
      });
    }
    console.log('[FB-Collector] Collection stopped');
    this.broadcastState('Collection stopped');
  }

  /**
   * Resets collected data
   */
  reset() {
    this.status = 'idle';
    clearTimeout(this.loopTimer);
    this.collectedMap.clear();
    this.scannedReels = [];
    this.currentReelIndex = 0;
    this.pageAuthorInfo = null;
    this.isWalkingReels = false;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        fb_reels_queue_active: false,
        fb_reels_queue: [],
        fb_reels_queue_index: 0
      });
    }
    this.broadcastState('Ready');
  }

  // ============================================================
  // TWO-PHASE REELS ENGINE
  // ============================================================

  /**
   * Initiates Two-Phase Reels Engine:
   * Phase 1: Pre-scans grid to collect initial list of target reels with exact scroll positions
   * Phase 2: Sequential redirect walkthrough: redirects to link 1, extracts all data; redirects to link 2, etc.
   */
  async startReelTwoPhaseEngine() {
    this.scannedReels = [];
    this.collectedMap.clear();
    this.currentReelIndex = 0;
    this.pageAuthorInfo = ReelsExtractor.extractPageAuthorInfo();

    // PHASE 1: Pre-scan grid to discover target count reels
    await this.scanGridLoop();
  }

  /**
   * Phase 1 Loop: Scrolls grid until targetCount reels are indexed
   */
  async scanGridLoop() {
    if (this.status !== 'running') return;

    if (!this.pageAuthorInfo || !this.pageAuthorInfo.name) {
      this.pageAuthorInfo = ReelsExtractor.extractPageAuthorInfo();
    }

    const currentTiles = ReelsExtractor.scanGridReels();
    const seenIds = new Set(this.scannedReels.map(r => r.id));

    let newlyFound = 0;
    currentTiles.forEach(tile => {
      if (!seenIds.has(tile.id)) {
        seenIds.add(tile.id);
        if (this.pageAuthorInfo) {
          tile.authorName = this.pageAuthorInfo.name || tile.authorName;
          tile.authorHandle = this.pageAuthorInfo.handle || tile.authorHandle;
          tile.authorAvatar = this.pageAuthorInfo.avatar || tile.authorAvatar;
          tile.authorVerified = this.pageAuthorInfo.verified || false;
        }
        this.scannedReels.push(tile);
        this.collectedMap.set(tile.id, tile);
        newlyFound++;
      }
    });

    this.broadcastState(`Phase 1: Pre-scanning grid (${this.scannedReels.length}/${this.targetCount} reels found)...`);

    // Check if target reached in Phase 1
    if (this.scannedReels.length >= this.targetCount) {
      this.scannedReels = this.scannedReels.slice(0, this.targetCount);
      console.log(`[FB-Collector] Phase 1 complete: Pre-scanned ${this.scannedReels.length} reels.`);
      await this.startPhase2SequentialWalk();
      return;
    }

    // Check bottom of page
    if (newlyFound === 0) {
      this.consecutiveNoNewCount++;
      if (this.consecutiveNoNewCount >= this.maxNoNewThreshold) {
        console.log(`[FB-Collector] Reached end of grid. Found total ${this.scannedReels.length} reels.`);
        await this.startPhase2SequentialWalk();
        return;
      }
    } else {
      this.consecutiveNoNewCount = 0;
    }

    // Scroll down grid to load more tiles
    window.scrollBy({ top: Math.floor(window.innerHeight * 0.85), behavior: 'smooth' });

    this.loopTimer = setTimeout(() => {
      this.scanGridLoop();
    }, 1100);
  }

  /**
   * Phase 2: Sequential Reel Walkthrough
   * Initializes queue and redirects to the first reel link!
   */
  async startPhase2SequentialWalk() {
    if (this.status !== 'running' || this.scannedReels.length === 0) return;

    this.broadcastState(`Phase 1 complete (${this.scannedReels.length} reels indexed)! Redirecting to Reel 1...`);
    console.log(`[FB-Collector] Phase 1 complete: ${this.scannedReels.length} reels indexed. Initiating sequential redirects...`);

    const queue = this.scannedReels.map((item, idx) => ({
      ...item,
      queueIndex: idx
    }));

    // Save complete session state to chrome.storage.local before redirecting
    await new Promise(resolve => {
      chrome.storage.local.set({
        fb_reels_queue: queue,
        fb_reels_queue_index: 0,
        fb_reels_queue_active: true,
        fb_reels_target_count: queue.length,
        fb_reels_origin_url: window.location.href,
        fb_page_author_info: this.pageAuthorInfo,
        fb_reels_delay_ms: this.delayMs,
        fb_collector_data: queue,
        fb_collector_state: {
          status: 'running',
          count: 0,
          targetCount: queue.length,
          mode: 'reels',
          lastUpdated: new Date().toISOString()
        }
      }, resolve);
    });

    const firstReel = queue[0];
    if (firstReel && firstReel.url) {
      console.log(`[FB-Collector] Redirecting to first reel: ${firstReel.url}`);
      await new Promise(r => setTimeout(r, 600));
      window.location.href = firstReel.url;
    }
  }

  /**
   * Checks if an active sequential queue is in progress on page load
   */
  async checkAndResumeQueue() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

    chrome.storage.local.get([
      'fb_reels_queue_active',
      'fb_reels_queue',
      'fb_reels_queue_index',
      'fb_page_author_info',
      'fb_reels_origin_url',
      'fb_reels_delay_ms'
    ], async (res) => {
      if (!res || !res.fb_reels_queue_active || !Array.isArray(res.fb_reels_queue)) {
        return;
      }

      const queue = res.fb_reels_queue;
      const index = parseInt(res.fb_reels_queue_index, 10) || 0;
      const originUrl = res.fb_reels_origin_url || '';
      const pageAuthor = res.fb_page_author_info || null;
      const delayMs = res.fb_reels_delay_ms || 1800;

      console.log(`[FB-Collector] Resuming Phase 2 sequential queue at Reel ${index + 1}/${queue.length} on ${window.location.href}`);

      this.status = 'running';
      this.scannedReels = queue;
      this.currentReelIndex = index;
      this.pageAuthorInfo = pageAuthor;
      this.targetCount = queue.length;
      this.delayMs = delayMs;
      queue.forEach(item => {
        this.collectedMap.set(item.id, item);
        if (item.views > 0) {
          ReelsExtractor.gridViewsMap.set(item.id, item.views);
        }
      });

      await this.handleActiveReelPage(queue, index, pageAuthor, originUrl, delayMs);
    });
  }

  /**
   * Scrapes data on the current reel page and redirects to the next link
   */
  async handleActiveReelPage(queue, index, pageAuthor, originUrl, delayMs) {
    if (index >= queue.length) {
      await this.finishQueue(queue, originUrl);
      return;
    }

    const currentReel = queue[index];
    const progressLabel = `Reel ${index + 1}/${queue.length}`;
    console.log(`[FB-Collector] Phase 2: Collecting ${progressLabel}: ID=${currentReel.id}, URL=${window.location.href}`);

    // 1. Mandatory 3-second pause for Facebook to completely load video, player, and action bar metrics
    console.log(`[FB-Collector] Waiting 3.0s for Reel ${index + 1}/${queue.length} to fully render authentic data...`);
    this.broadcastState(`Phase 2: Loading ${progressLabel} (waiting 3s for full render)...`);
    await new Promise(r => setTimeout(r, 3000));

    // 2. Expand caption if collapsed and wait for DOM text expansion
    ReelsExtractor.expandCaptionIfCollapsed();
    await new Promise(r => setTimeout(r, 400));

    // 3. Adaptive polling: verify metrics rendered in DOM
    let details = null;
    const pollStart = Date.now();
    const maxPollMs = 2500;

    while (Date.now() - pollStart < maxPollMs) {
      // Check if user stopped collection
      const stateCheck = await new Promise(r => {
        chrome.storage.local.get(['fb_reels_queue_active'], r);
      });
      if (!stateCheck || !stateCheck.fb_reels_queue_active) {
        console.log('[FB-Collector] Queue halted by user request.');
        this.status = 'stopped';
        return;
      }

      details = ReelsExtractor.scrapeActivePlayer(currentReel.id, currentReel.url, pageAuthor);

      // If we got engagement metrics, break
      if (details.reactions > 0 || details.comments > 0 || details.shares > 0) {
        break;
      }

      await new Promise(r => setTimeout(r, 400));
    }

    if (!details) {
      details = ReelsExtractor.scrapeActivePlayer(currentReel.id, currentReel.url, pageAuthor);
    }

    // 3. Merge deep details into current reel object
    currentReel.authorName = details.authorName || currentReel.authorName;
    currentReel.authorHandle = details.authorHandle || currentReel.authorHandle;
    currentReel.authorAvatar = details.authorAvatar || currentReel.authorAvatar;
    currentReel.authorVerified = details.authorVerified;
    currentReel.caption = details.caption || currentReel.caption;
    currentReel.content = details.content || currentReel.content;
    currentReel.reactions = details.reactions;
    currentReel.comments = details.comments;
    currentReel.shares = details.shares;
    if (details.views > 0) currentReel.views = details.views;
    currentReel.mediaUrl = details.mediaUrl || currentReel.mediaUrl;
    currentReel.thumbnail = details.thumbnail || currentReel.thumbnail;
    currentReel.images = details.images || currentReel.images;
    if (details.videoLength && details.videoLength !== 'N/A') {
      currentReel.videoLength = details.videoLength;
    }
    if (details.publishedDate && details.publishedDate !== 'Recent') {
      currentReel.publishedDate = details.publishedDate;
      currentReel.postedAt = details.publishedDate;
    }
    currentReel.isEnriched = true;

    queue[index] = currentReel;
    this.collectedMap.set(currentReel.id, currentReel);

    // 4. Update chrome.storage.local with enriched item and current state
    await new Promise(r => {
      chrome.storage.local.set({
        fb_reels_queue: queue,
        fb_collector_data: queue,
        fb_collector_state: {
          status: 'running',
          count: index + 1,
          targetCount: queue.length,
          mode: 'reels',
          lastUpdated: new Date().toISOString()
        }
      }, r);
    });

    const lengthSuffix = currentReel.videoLength && currentReel.videoLength !== 'N/A' ? ` · ⏱ ${currentReel.videoLength}` : '';
    this.broadcastState(`Phase 2: Collected ${progressLabel} · ${currentReel.reactions} Likes, ${currentReel.comments} Comments${lengthSuffix}`);

    // 6. Check if more reels remain in the queue
    const nextIndex = index + 1;
    if (nextIndex < queue.length) {
      const nextReel = queue[nextIndex];

      // Save next index to storage
      await new Promise(r => {
        chrome.storage.local.set({
          fb_reels_queue_index: nextIndex
        }, r);
      });

      this.broadcastState(`Phase 2: Redirecting to Reel ${nextIndex + 1}/${queue.length}...`);
      console.log(`[FB-Collector] Redirecting to Reel ${nextIndex + 1}/${queue.length}: ${nextReel.url}`);

      // Final check if user stopped collection
      const finalCheck = await new Promise(r => {
        chrome.storage.local.get(['fb_reels_queue_active'], r);
      });
      if (!finalCheck || !finalCheck.fb_reels_queue_active) {
        console.log('[FB-Collector] Redirect cancelled because session was stopped.');
        return;
      }

      // Small delay for UI and storage flush, then redirect to next reel link!
      await new Promise(r => setTimeout(r, 450));
      window.location.href = nextReel.url;
    } else {
      // 7. All reels completed!
      await this.finishQueue(queue, originUrl);
    }
  }

  /**
   * Finalizes sequential collection and returns to origin page
   */
  async finishQueue(queue, originUrl) {
    this.status = 'completed';
    console.log(`[FB-Collector] All ${queue.length} reels enriched!`);
    this.broadcastState(`✓ Complete! All ${queue.length} Reels enriched with full metrics!`);

    await new Promise(r => {
      chrome.storage.local.set({
        fb_reels_queue_active: false,
        fb_reels_queue_index: queue.length,
        fb_collector_data: queue,
        fb_collector_state: {
          status: 'completed',
          count: queue.length,
          targetCount: queue.length,
          mode: 'reels',
          lastUpdated: new Date().toISOString()
        }
      }, r);
    });

    // If origin URL was saved, return to the Page's Reels tab after 1.5s
    if (originUrl && originUrl.includes('facebook.com')) {
      console.log(`[FB-Collector] Returning to origin page: ${originUrl}`);
      setTimeout(() => {
        window.location.href = originUrl;
      }, 1500);
    }
  }

  getEnrichedCount() {
    let count = 0;
    for (const item of this.collectedMap.values()) {
      if (item.isEnriched) count++;
    }
    return count;
  }

  // ============================================================
  // POST TIMELINE FEED COLLECTION ENGINE
  // ============================================================

  startPostCollection() {
    this.stepPostCollection();
  }

  stepPostCollection() {
    if (this.status !== 'running') return;

    const previousCount = this.collectedMap.size;

    const posts = PostsExtractor.extractVisiblePosts();
    posts.forEach(post => {
      const key = post.id || post.url;
      if (key && !this.collectedMap.has(key)) {
        this.collectedMap.set(key, post);
      }
    });

    const currentCount = this.collectedMap.size;
    const newItemsFound = currentCount - previousCount;

    if (newItemsFound === 0) {
      this.consecutiveNoNewCount++;
      if (this.consecutiveNoNewCount >= this.maxNoNewThreshold) {
        this.status = 'completed';
        this.broadcastState('Reached end of timeline feed');
        return;
      }
    } else {
      this.consecutiveNoNewCount = 0;
    }

    if (currentCount >= this.targetCount) {
      this.status = 'completed';
      this.broadcastState(`✓ Collected ${currentCount} posts successfully!`);
      return;
    }

    window.scrollBy({ top: Math.floor(window.innerHeight * 0.85), behavior: 'smooth' });
    this.broadcastState(`Collecting posts (${currentCount}/${this.targetCount})...`);

    const jitter = Math.floor(Math.random() * 300) - 150;
    const nextDelay = Math.max(800, this.delayMs + jitter);

    this.loopTimer = setTimeout(() => {
      this.stepPostCollection();
    }, nextDelay);
  }

  /**
   * Determine effective mode based on current URL and user setting
   */
  resolveMode() {
    if (this.mode === 'reels') return 'reels';
    if (this.mode === 'posts') return 'posts';

    const path = window.location.pathname.toLowerCase();
    if (path.includes('/reels') || path.includes('/reel/')) {
      return 'reels';
    }
    return 'posts';
  }

  /**
   * Returns current array of items
   */
  getItems() {
    return Array.from(this.collectedMap.values());
  }

  /**
   * Broadcasts progress to popup, dashboard, and chrome.storage.local
   */
  broadcastState(message = '') {
    const items = this.getItems();
    const enrichedCount = this.getEnrichedCount();
    const displayCount = this.resolveMode() === 'reels' ? (enrichedCount || items.length) : items.length;

    const payload = {
      status: this.status,
      count: displayCount,
      targetCount: this.targetCount,
      message,
      mode: this.resolveMode(),
      items: items.slice(0, 1000)
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        fb_collector_data: items,
        fb_collector_state: {
          status: this.status,
          count: displayCount,
          targetCount: this.targetCount,
          mode: this.resolveMode(),
          lastUpdated: new Date().toISOString()
        }
      });
    }

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'COLLECTOR_UPDATE',
        payload
      }).catch(() => {});
    }
  }
}

// Global instance attached to window
window.__fbScrollManager = new ScrollManager();
