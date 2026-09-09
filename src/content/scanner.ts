import { ContentItem, PageProfile } from '../shared/types';
import { ScrapeOptions, ScrapeProgress } from '../shared/types/messages';
import { ScrollManager } from './scroll-manager';
import { PageDetector } from './page-detector';
import { PostParser } from './parsers/post-parser';
import { ReelParser } from './parsers/reel-parser';
import { ContentRepository } from '../database/repositories/content-repository';

export class ContentScanner {
  private scrollManager: ScrollManager;
  private isScanning = false;
  private isPaused = false;
  private isCancelled = false;
  private seenIds = new Set<string>();
  private collectedItems: ContentItem[] = [];
  private pageProfile: PageProfile | null = null;
  private onProgress?: (progress: ScrapeProgress) => void;

  constructor(options?: { onProgress?: (progress: ScrapeProgress) => void }) {
    this.scrollManager = new ScrollManager();
    this.onProgress = options?.onProgress;
  }

  public getPageProfile(): PageProfile | null {
    return this.pageProfile;
  }

  public async start(options: ScrapeOptions): Promise<ContentItem[]> {
    if (this.isScanning) {
      console.warn('[FB-Analytics] Scanner is already running.');
      return this.collectedItems;
    }

    this.isScanning = true;
    this.isPaused = false;
    this.isCancelled = false;
    this.seenIds.clear();
    this.collectedItems = [];
    this.scrollManager.reset();

    const { page, mode: detectedMode } = PageDetector.detect();
    this.pageProfile = page;

    const pageName = page?.name || 'Facebook Page';
    const targetCount = options.targetCount || 50;
    const mode = options.mode === 'both' ? detectedMode : options.mode;

    this.emitProgress({
      status: 'preparing',
      count: 0,
      targetCount,
      message: `Starting collection for ${pageName} (${mode})...`,
      items: []
    });

    try {
      if (mode === 'reels') {
        await this.scanReels(targetCount, pageName);
      } else {
        await this.scanPosts(targetCount, pageName);
      }

      if (this.isCancelled) {
        this.emitProgress({
          status: 'cancelled',
          count: this.collectedItems.length,
          targetCount,
          message: 'Collection cancelled by user.',
          items: this.collectedItems
        });
      } else {
        this.emitProgress({
          status: 'completed',
          count: this.collectedItems.length,
          targetCount,
          message: `Successfully collected ${this.collectedItems.length} items.`,
          items: this.collectedItems
        });
      }
    } catch (err: any) {
      console.error('[FB-Analytics] Scan error:', err);
      this.emitProgress({
        status: 'failed',
        count: this.collectedItems.length,
        targetCount,
        message: `Collection error: ${err?.message || 'Unknown error'}`,
        items: this.collectedItems
      });
    } finally {
      this.isScanning = false;
    }

    return this.collectedItems;
  }

  public pause(): void {
    this.isPaused = true;
    this.scrollManager.pause();
    this.emitProgress({
      status: 'paused',
      count: this.collectedItems.length,
      targetCount: this.collectedItems.length,
      message: 'Collection paused.',
      items: this.collectedItems
    });
  }

  public resume(): void {
    this.isPaused = false;
    this.scrollManager.resume();
    this.emitProgress({
      status: 'scanning',
      count: this.collectedItems.length,
      targetCount: this.collectedItems.length,
      message: 'Resuming collection...',
      items: this.collectedItems
    });
  }

  public cancel(): void {
    this.isCancelled = true;
    this.scrollManager.cancel();
  }

  /**
   * Posts Scanning Loop
   */
  private async scanPosts(targetCount: number, pageName: string): Promise<void> {
    while (this.collectedItems.length < targetCount && !this.isCancelled) {
      if (this.isPaused) {
        await this.sleep(500);
        continue;
      }

      // Query candidate post containers
      const candidates = document.querySelectorAll(
        '[role="feed"] > div, [role="article"], div[data-pagelet*="FeedUnit"]'
      );

      for (const el of Array.from(candidates)) {
        if (this.collectedItems.length >= targetCount || this.isCancelled) break;

        const post = PostParser.parse(el, pageName);
        if (post && !this.seenIds.has(post.id)) {
          this.seenIds.add(post.id);
          this.collectedItems.push(post);

          // Persist incrementally to IndexedDB
          await ContentRepository.saveOrUpdate(post);

          this.emitProgress({
            status: 'extracting',
            count: this.collectedItems.length,
            targetCount,
            currentItem: post,
            items: this.collectedItems
          });
        }
      }

      if (this.collectedItems.length >= targetCount) break;

      // Scroll to trigger next batch
      const { reachedEnd } = await this.scrollManager.scrollDown();
      if (reachedEnd) {
        console.log('[FB-Analytics] Reached end of posts feed.');
        break;
      }
    }
  }

  /**
   * Reels Scanning: Phase 1 Grid Scan + Active Player fallback
   */
  private async scanReels(targetCount: number, pageName: string): Promise<void> {
    // Check if directly on a single Reel page
    if (window.location.pathname.includes('/reel/')) {
      const reel = ReelParser.parseActivePlayer(null, null, pageName);
      if (reel && !this.seenIds.has(reel.id)) {
        this.seenIds.add(reel.id);
        this.collectedItems.push(reel);
        await ContentRepository.saveOrUpdate(reel);

        this.emitProgress({
          status: 'extracting',
          count: 1,
          targetCount: 1,
          currentItem: reel,
          items: this.collectedItems
        });
      }
      return;
    }

    // Phase 1: Grid Scan on /reels/ tab
    while (this.collectedItems.length < targetCount && !this.isCancelled) {
      if (this.isPaused) {
        await this.sleep(500);
        continue;
      }

      const gridCards = document.querySelectorAll(
        'a[href*="/reel/"], div[role="main"] a[href*="/reel/"]'
      );

      for (const anchor of Array.from(gridCards)) {
        if (this.collectedItems.length >= targetCount || this.isCancelled) break;

        // Container card is either anchor or immediate parent
        const card = anchor.closest('div[style*="aspect-ratio"], div[role="article"]') || anchor;
        const reel = ReelParser.parseGridCard(card, pageName);

        if (reel && !this.seenIds.has(reel.id)) {
          this.seenIds.add(reel.id);

          // Check if Relay scripts already have exact metadata for this reel
          const relay = ReelParser.extractFromRelayScripts(reel.id);
          if (relay.reactions !== null) reel.reactions = relay.reactions;
          if (relay.comments !== null) reel.comments = relay.comments;
          if (relay.shares !== null) reel.shares = relay.shares;
          if (relay.videoDurationSeconds !== null) {
            reel.durationSeconds = relay.videoDurationSeconds;
            reel.durationFormatted = `${Math.floor(relay.videoDurationSeconds / 60)} min ${relay.videoDurationSeconds % 60} sec`;
          }

          if (reel.reactions !== null || reel.comments !== null) {
            reel.extractionStatus = 'complete';
          }

          this.collectedItems.push(reel);
          await ContentRepository.saveOrUpdate(reel);

          this.emitProgress({
            status: 'extracting',
            count: this.collectedItems.length,
            targetCount,
            currentItem: reel,
            items: this.collectedItems
          });
        }
      }

      if (this.collectedItems.length >= targetCount) break;

      const { reachedEnd } = await this.scrollManager.scrollDown();
      if (reachedEnd) {
        console.log('[FB-Analytics] Reached end of reels grid.');
        break;
      }
    }
  }

  private emitProgress(progress: ScrapeProgress): void {
    if (this.onProgress) {
      this.onProgress(progress);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
