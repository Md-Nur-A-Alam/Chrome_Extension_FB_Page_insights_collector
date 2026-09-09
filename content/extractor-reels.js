/**
 * Extractor for Facebook Page Reels
 * Designed specifically for the Two-Phase Grid-Scan + In-Reel Player Walkthrough.
 * Phase 1: Pre-scans and indexes all reel tiles from the grid with accurate scroll positions.
 * Phase 2: Opens each reel individually, extracts full metrics (Reactions, Comments, Shares, Views, Full Caption,
 * Author details, Video Length, Posted Date), and returns to grid.
 */

const ReelsExtractor = {
  // Grid views map: Reel ID -> Views integer
  gridViewsMap: new Map(),

  /**
   * Scans all reel cards currently rendered on the grid
   * Returns array of { id, url, views, thumbnail, scrollY, anchor }
   */
  scanGridReels() {
    const results = [];
    const reelLinks = document.querySelectorAll('a[href*="/reel/"]');
    const seenIds = new Set();

    reelLinks.forEach(anchor => {
      const rawHref = anchor.getAttribute('href') || anchor.href || '';
      const cleanUrl = Parser.cleanUrl(rawHref);
      const id = Parser.extractId(cleanUrl).replace(/^reel_/, '');

      if (!id || seenIds.has(id)) return;
      seenIds.add(id);

      const card = anchor.closest('div[role="article"]') || anchor.closest('div[tabindex="0"]') || anchor.parentElement;
      const target = card || anchor;

      // Extract view count from thumbnail badge
      let views = 0;
      const spans = target.querySelectorAll('span, div');
      for (const s of spans) {
        const text = s.textContent.trim();
        if (/^[০-৯0-9]+(?:\.[০-৯0-9]+)?[KMBkmbহাজারলাখকোটি]?$/.test(text) && text.length < 15) {
          const val = Parser.parseMetric(text);
          if (val > 0) {
            views = val;
            break;
          }
        }
      }

      // Thumbnail image
      let thumbnail = '';
      const img = target.querySelector('img[src*="scontent"], img[src*="fbcdn"]');
      if (img && img.src) thumbnail = img.src;

      // Caption snippet if on card
      let caption = '';
      const textNodes = target.querySelectorAll('span[dir="auto"], div[dir="auto"]');
      for (const node of textNodes) {
        const t = (node.textContent || '').trim();
        if (t.length > 5 && !/^[0-9:]+$/.test(t) && !/(views|view|ভিউ)/i.test(t)) {
          caption = Parser.cleanText(t);
          break;
        }
      }

      // Compute exact vertical offset on page
      const rect = anchor.getBoundingClientRect();
      const scrollY = Math.max(0, Math.round(rect.top + window.scrollY));

      this.gridViewsMap.set(id, views);

      results.push({
        id,
        postId: id,
        url: cleanUrl,
        postUrl: cleanUrl,
        type: 'reel',
        postType: 'video',
        mediaType: 'image',
        views,
        thumbnail,
        mediaUrl: thumbnail,
        images: thumbnail,
        caption,
        content: caption,
        videoLength: 'N/A',
        reactions: 0,
        comments: 0,
        shares: 0,
        publishedDate: 'Recent',
        postedAt: 'Recent',
        isEnriched: false,
        scrollY,
        anchor
      });
    });

    return results;
  },

  /**
   * Captures the Facebook Page's master author information while on the page
   */
  extractPageAuthorInfo() {
    let name = '';
    let handle = '';
    let avatar = '';
    let verified = false;

    // 1. Page Name from h1
    const h1 = document.querySelector('h1');
    if (h1 && h1.textContent.trim()) {
      name = h1.textContent.trim();
    }

    // Fallback: document.title
    if (!name) {
      const parts = document.title.split(/\||•|-/);
      if (parts.length > 0 && !parts[0].includes('Facebook')) {
        name = parts[0].trim();
      }
    }

    // 2. Page Handle from URL
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0 && !['reel', 'reels', 'watch', 'videos', 'posts'].includes(pathParts[0])) {
      handle = pathParts[0];
    }

    // 3. Known page overrides if name still generic
    if (window.location.href.includes('pedagoacademy')) {
      if (!name || name === 'Facebook') name = 'Pedago Academy';
      handle = 'pedagoacademy';
    } else if (window.location.href.includes('TechDeck')) {
      if (!name || name === 'Facebook') name = 'TechDeck.BD';
      handle = 'TechDeck.BD';
    }

    // 4. Page Avatar
    const profileImg = document.querySelector('svg[aria-label] image, div[role="main"] img, img[alt*="profile"], img[alt*="avatar"]');
    if (profileImg) {
      avatar = profileImg.getAttribute('xlink:href') || profileImg.src || '';
    }

    // 5. Verified badge
    const badge = document.querySelector('[aria-label*="Verified"], [aria-label*="ভেরিফাইড"], svg[aria-label*="Verified"]');
    if (badge) {
      verified = true;
    }

    return { name, handle, avatar, verified };
  },

  /**
   * Scrapes the active Reel inside Facebook's Reel Player modal
   * @param {string|null} targetId
   * @param {string|null} targetUrl
   * @param {Object|null} pageAuthorInfo
   * @returns {Object}
   */
  scrapeActivePlayer(targetId = null, targetUrl = null, pageAuthorInfo = null) {
    const currentUrl = window.location.href;
    const cleanUrl = targetUrl || Parser.cleanUrl(currentUrl);
    let id = Parser.extractId(cleanUrl).replace(/^reel_/, '');
    if (!id && targetId) id = targetId;

    // Auto-mute video to prevent blaring audio during automated scraping
    const video = document.querySelector('video');
    if (video) {
      video.muted = true;
    }

    // 1. Author Name, Handle, and Avatar (with fallback to page author)
    const authorInfo = this.extractAuthorInfo(pageAuthorInfo);

    // 2. Expand "...more" / "আরও দেখুন" if caption is collapsed
    this.expandCaptionIfCollapsed();

    // 3. Extract Full Content / Caption (strictly excluding comments!)
    const content = this.extractPlayerCaption();

    // 4. Extract Engagement Metrics (Reactions, Comments, Shares, Views)
    const metrics = this.extractPlayerMetrics(id);

    // 5. Media URL & Video Info
    const mediaInfo = this.extractPlayerMedia(id);

    // 6. Posted At Date
    const postedAt = this.extractPlayerPostedDate(id);

    return {
      id,
      postId: id,
      type: 'reel',
      postType: 'video',
      mediaType: 'image',
      url: cleanUrl,
      postUrl: cleanUrl,
      authorName: authorInfo.name || 'Facebook Page',
      authorHandle: authorInfo.handle || '',
      authorId: authorInfo.id || '',
      authorAvatar: authorInfo.avatar || '',
      authorVerified: authorInfo.verified,
      caption: content || '',
      content: content || '',
      reactions: metrics.reactions,
      comments: metrics.comments,
      shares: metrics.shares,
      views: metrics.views,
      mediaUrl: mediaInfo.mediaUrl || mediaInfo.thumbnail || '',
      thumbnail: mediaInfo.thumbnail || '',
      images: mediaInfo.mediaUrl || mediaInfo.thumbnail || '',
      videoLength: mediaInfo.videoLength || 'N/A',
      publishedDate: postedAt || 'Recent',
      postedAt: postedAt || 'Recent',
      scrapedAt: new Date().toLocaleString(),
      collectedAt: new Date().toISOString(),
      isEnriched: true
    };
  },

  /**
   * Extracts author details from the active Reel player
   */
  extractAuthorInfo(pageAuthorInfo = null) {
    let name = '';
    let handle = '';
    let id = '';
    let avatar = '';
    let verified = false;

    // Search author headers in player
    const authorLinks = document.querySelectorAll('a[role="link"]');
    for (const a of authorLinks) {
      const href = a.getAttribute('href') || '';
      if (
        href.includes('/pedagoacademy') ||
        href.includes('/TechDeck.BD') ||
        (!href.includes('/reel/') && !href.includes('/watch') && !href.includes('/hashtag/') && href.length > 15)
      ) {
        const text = (a.textContent || '').trim();
        if (text.length > 2 && text.length < 50 && !text.includes('Follow') && !text.includes('ফলো')) {
          name = text;
          handle = href.replace(/^https?:\/\/(www\.)?facebook\.com\//, '').replace(/\/$/, '').split('?')[0];
          
          const img = a.querySelector('img') || a.parentElement?.querySelector('img');
          if (img && img.src) {
            avatar = img.src;
          }
          break;
        }
      }
    }

    // Fallback to page-level author info
    if (!name && pageAuthorInfo) {
      name = pageAuthorInfo.name || '';
      handle = pageAuthorInfo.handle || '';
      avatar = pageAuthorInfo.avatar || '';
      verified = pageAuthorInfo.verified || false;
    }

    if (!name) {
      if (window.location.href.includes('pedagoacademy')) {
        name = 'Pedago Academy';
        handle = 'pedagoacademy';
      } else if (window.location.href.includes('TechDeck')) {
        name = 'TechDeck.BD';
        handle = 'TechDeck.BD';
      } else {
        const titleParts = document.title.split('|')[0].split('•')[0].trim();
        if (titleParts && !titleParts.includes('Facebook') && !titleParts.includes('Reel')) {
          name = titleParts;
        }
      }
    }

    const verifiedBadge = document.querySelector('[aria-label*="Verified"], [aria-label*="ভেরিফাইড"], svg[aria-label*="Verified"]');
    if (verifiedBadge) {
      verified = true;
    }

    return { name, handle, id, avatar, verified };
  },

  /**
   * Automatically clicks "...more" / "...আরও দেখুন" in the reel viewer to expand the full caption
   */
  expandCaptionIfCollapsed() {
    const expandButtons = document.querySelectorAll('div[role="button"], span[role="button"]');
    expandButtons.forEach(btn => {
      const txt = (btn.textContent || '').trim().toLowerCase();
      if (txt === 'more' || txt === '...more' || txt === 'আরও দেখুন' || txt === '...আরও' || txt === 'see more') {
        try { btn.click(); } catch (e) {}
      }
    });
  },

  /**
   * Extracts full caption text from active player
   * STRICT FIX: Discards any text belonging to comment containers!
   */
  extractPlayerCaption() {
    // 1. Identify all comment elements to blacklist
    const commentRoots = document.querySelectorAll(
      '[aria-label*="Comment"], [aria-label*="comment"], [aria-label*="মন্তব্য"], div[role="article"], form'
    );
    const commentElements = new Set();
    commentRoots.forEach(root => {
      commentElements.add(root);
      root.querySelectorAll('*').forEach(child => commentElements.add(child));
    });

    // 2. Examine candidate text elements outside of comments
    const candidateNodes = document.querySelectorAll('div[dir="auto"], span[dir="auto"]');
    let bestCaption = '';

    for (const node of candidateNodes) {
      if (commentElements.has(node)) continue;
      if (
        node.closest('[role="article"]') ||
        node.closest('form') ||
        node.closest('ul') ||
        node.closest('[role="button"]') ||
        node.closest('[aria-label*="Comment"]') ||
        node.closest('[aria-label*="মন্তব্য"]')
      ) {
        continue;
      }

      const text = (node.innerText || node.textContent || '').trim();
      if (!text || text.length < 3) continue;

      // Filter out navigation/action strings and pure numbers
      if (/^(like|comment|share|follow|views|view|ফলো|লাইক|মন্তব্য|শেয়ার|original audio|audio)$/i.test(text)) continue;
      if (/^[০-৯0-9.,KMBkmbহাজারলাখকোটি]+$/.test(text)) continue;

      if (text.length > bestCaption.length && !/(like|comment|share|reels|follow|ফলো|লাইক|মন্তব্য)/i.test(text)) {
        bestCaption = text;
      }
    }

    if (bestCaption) {
      return Parser.cleanText(bestCaption);
    }

    const metaDesc = document.querySelector('meta[property="og:description"]');
    if (metaDesc && metaDesc.content) {
      return Parser.cleanText(metaDesc.content);
    }

    return '';
  },

  /**
   * Scans Facebook Relay JSON script tags for exact metrics and timestamps
   */
  extractFromRelayScripts(reelId) {
    const data = {
      reactions: 0,
      comments: 0,
      shares: 0,
      views: 0,
      videoLengthSec: 0,
      creationTime: null
    };

    try {
      const scripts = document.querySelectorAll('script[type="application/json"]');
      if (!scripts || scripts.length === 0) return data;

      for (const script of scripts) {
        const content = script.textContent;
        if (!content || (!content.includes('feedback') && !content.includes('reaction_count') && !content.includes('playable_duration_in_ms') && !content.includes('creation_time'))) {
          continue;
        }

        // 1. Reactions: "reaction_count":{"count": 1245} or "total_reaction_count": 1245
        if (data.reactions === 0) {
          const mReact = content.match(/["']reaction_count["']\s*:\s*(?:\{\s*["']count["']\s*:\s*(\d+)|(\d+))/);
          if (mReact) {
            data.reactions = parseInt(mReact[1] || mReact[2], 10) || 0;
          }
          if (data.reactions === 0) {
            const mTotalReact = content.match(/["']total_reaction_count["']\s*:\s*(\d+)/);
            if (mTotalReact) data.reactions = parseInt(mTotalReact[1], 10) || 0;
          }
        }

        // 2. Comments: "total_comment_count": 45 or "comment_count":{"total_count": 45}
        if (data.comments === 0) {
          const mComm = content.match(/["'](?:total_comment_count|comment_count|comments)["']\s*:\s*(?:\{\s*["']total_count["']\s*:\s*(\d+)|(\d+))/);
          if (mComm) {
            data.comments = parseInt(mComm[1] || mComm[2], 10) || 0;
          }
          if (data.comments === 0) {
            const mCommAlt = content.match(/["']comments_count_summary_renderer["'][\s\S]*?["']total_count["']\s*:\s*(\d+)/);
            if (mCommAlt) data.comments = parseInt(mCommAlt[1], 10) || 0;
          }
        }

        // 3. Shares: "share_count":{"count": 12} or "share_count_num": 12
        if (data.shares === 0) {
          const mShare = content.match(/["'](?:share_count|share_count_num)["']\s*:\s*(?:\{\s*["']count["']\s*:\s*(\d+)|(\d+))/);
          if (mShare) {
            data.shares = parseInt(mShare[1] || mShare[2], 10) || 0;
          }
        }

        // 4. Video duration
        if (data.videoLengthSec === 0) {
          const mDurMs = content.match(/["']playable_duration_in_ms["']\s*:\s*(\d+)/);
          if (mDurMs) {
            data.videoLengthSec = Math.round(parseInt(mDurMs[1], 10) / 1000);
          } else {
            const mDurSec = content.match(/["'](?:length_in_second|video_duration)["']\s*:\s*(\d+)/);
            if (mDurSec) data.videoLengthSec = parseInt(mDurSec[1], 10);
          }
        }

        // 5. Creation / Publish time
        if (!data.creationTime) {
          const mTime = content.match(/["'](?:creation_time|publish_time|video_publish_date)["']\s*:\s*(\d{9,12})/);
          if (mTime) {
            data.creationTime = parseInt(mTime[1], 10);
          }
        }

        if (data.reactions > 0 && data.comments > 0 && data.shares > 0 && data.videoLengthSec > 0 && data.creationTime) {
          break;
        }
      }
    } catch (e) {
      console.warn('[FB-Collector] Relay script extraction notice:', e);
    }

    return data;
  },

  /**
   * Extracts reaction, comment, share, and view counts from active player
   */
  extractPlayerMetrics(reelId) {
    // 1. Primary: In-page Relay JSON scripts (exact unrounded numbers)
    const relay = this.extractFromRelayScripts(reelId);
    let reactions = relay.reactions || 0;
    let comments = relay.comments || 0;
    let shares = relay.shares || 0;
    let views = this.gridViewsMap.get(reelId) || relay.views || 0;

    // 2. Secondary / DOM: Inspect action buttons and count labels
    const actionButtons = document.querySelectorAll(
      'div[role="button"][aria-label], span[role="button"][aria-label], a[role="button"][aria-label], div[role="button"]'
    );

    actionButtons.forEach(btn => {
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      // Look for count inside button or its immediate container
      const container = btn.closest('div[role="toolbar"]') || btn.parentElement;
      const countSpan = btn.querySelector('span[dir="auto"]') ||
                        btn.nextElementSibling ||
                        container?.querySelector('span[dir="auto"]');

      const countText = countSpan ? (countSpan.textContent || '').trim() : '';
      let num = Parser.parseMetric(countText);
      if (num === 0) num = Parser.parseMetric(aria);
      if (num === 0 && container) {
        num = Parser.parseMetric(container.textContent || '');
      }

      // Reactions: Like, Heart, Reactions, etc.
      if (/(?:like|reaction|лайк|লাইক|প্রতিক্রিয়া|me gusta|react)/i.test(aria)) {
        if (num > reactions) reactions = num;
      }

      // Comments
      if (/(?:comment|মন্তব্য|comentar)/i.test(aria)) {
        if (num > comments) comments = num;
      }

      // Shares
      if (/(?:share|শেয়ার|শেয়ার|compartir|send this to friends)/i.test(aria)) {
        if (num > shares) shares = num;
      }
    });

    // 3. Comments Drawer Header scan (if open or rendered in DOM)
    if (comments === 0) {
      const commentHeaders = document.querySelectorAll('h2, h3, span[dir="auto"], div[dir="auto"]');
      for (const el of commentHeaders) {
        const txt = (el.textContent || '').trim();
        if (/(?:comments|মন্তব্য|টি মন্তব্য)\b/i.test(txt) && txt.length < 30) {
          const parsed = Parser.parseMetric(txt);
          if (parsed > 0) {
            comments = parsed;
            break;
          }
        }
      }
    }

    // 4. Positional fallback for Reel Action Bar:
    // Vertical action bar beside reel video has standard order: 1st Like, 2nd Comment, 3rd Share
    if (reactions === 0 || comments === 0) {
      const actionColumns = document.querySelectorAll(
        'div[data-pagelet*="Reel"] div, div[role="dialog"] div, div[role="main"] div'
      );
      for (const col of actionColumns) {
        const buttons = col.querySelectorAll(':scope > div > div[role="button"], :scope > div[role="button"]');
        if (buttons.length >= 2 && buttons.length <= 6) {
          const counts = [];
          buttons.forEach(b => {
            const span = b.querySelector('span') || b.parentElement?.querySelector('span');
            if (span) {
              const val = Parser.parseMetric(span.textContent || '');
              counts.push(val);
            }
          });
          if (counts.length >= 2 && counts[0] > 0) {
            if (reactions === 0) reactions = counts[0];
            if (comments === 0 && counts.length > 1) comments = counts[1];
            if (shares === 0 && counts.length > 2) shares = counts[2];
            break;
          }
        }
      }
    }

    // 5. Views fallback from DOM if still 0
    if (views === 0) {
      const viewNodes = document.querySelectorAll('span, div');
      for (const node of viewNodes) {
        const t = (node.textContent || '').trim();
        if (/(?:views|view|ভিউ|বার দেখা হয়েছে)/i.test(t) && t.length < 30) {
          const parsed = Parser.parseMetric(t);
          if (parsed > 0) {
            views = parsed;
            break;
          }
        }
      }
    }

    return { reactions, comments, shares, views };
  },

  /**
   * Extracts media URL and formatted video length ('3 min 5 sec', '30 min 43 sec', etc.)
   */
  extractPlayerMedia(reelId = null) {
    let mediaUrl = '';
    let thumbnail = '';
    let videoLength = 'N/A';

    // 1. Check Relay JSON scripts first
    if (reelId) {
      const relay = this.extractFromRelayScripts(reelId);
      if (relay && relay.videoLengthSec > 0) {
        videoLength = Parser.formatVideoDuration(relay.videoLengthSec);
      }
    }

    // 2. Check HTML5 <video> element
    const video = document.querySelector('video');
    if (video) {
      if (video.poster) {
        thumbnail = video.poster;
        mediaUrl = video.poster;
      }
      if (video.src && video.src.startsWith('http')) {
        mediaUrl = video.src;
      }
      if (videoLength === 'N/A' && video.duration && !isNaN(video.duration) && video.duration > 0) {
        videoLength = Parser.formatVideoDuration(video.duration);
      }
    }

    // 3. Check player seekbar / progressbar
    if (videoLength === 'N/A') {
      const progress = document.querySelector('div[role="progressbar"], div[aria-valuemax]');
      if (progress) {
        const max = parseFloat(progress.getAttribute('aria-valuemax'));
        if (!isNaN(max) && max > 0 && max < 7200 && max !== 100) {
          videoLength = Parser.formatVideoDuration(max);
        }
      }
    }

    // 4. Check time text in player controls (e.g. "0:15 / 3:05")
    if (videoLength === 'N/A') {
      const timeSpans = document.querySelectorAll('span, div');
      for (const span of timeSpans) {
        const text = (span.textContent || '').trim();
        const match = text.match(/\/\s*([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)/);
        if (match) {
          const parts = match[1].split(':').map(Number);
          let sec = 0;
          if (parts.length === 3) sec = parts[0] * 3600 + parts[1] * 60 + parts[2];
          else if (parts.length === 2) sec = parts[0] * 60 + parts[1];
          if (sec > 0) {
            videoLength = Parser.formatVideoDuration(sec);
            break;
          }
        }
      }
    }

    if (!thumbnail) {
      const img = document.querySelector('img[src*="scontent"], img[src*="fbcdn"]');
      if (img) {
        thumbnail = img.src;
        if (!mediaUrl) mediaUrl = img.src;
      }
    }

    return { mediaUrl, thumbnail, videoLength };
  },

  /**
   * Extracts published date as relative time length:
   * e.g., '5hr ago', '3 days ago', '2 month ago', '1 year ago'
   */
  extractPlayerPostedDate(reelId = null) {
    // 1. Check Relay JSON scripts for exact creation_time / publish_time
    if (reelId) {
      const relay = this.extractFromRelayScripts(reelId);
      if (relay && relay.creationTime) {
        return Parser.formatTimeAgo(relay.creationTime);
      }
    }

    // 2. Check meta article:published_time
    const metaDate = document.querySelector('meta[property="article:published_time"]');
    if (metaDate && metaDate.content) {
      const relative = Parser.formatTimeAgo(metaDate.content);
      if (relative && relative !== 'Recent') {
        return relative;
      }
    }

    // 3. Search header timestamp anchors and spans near author
    const headerAnchors = document.querySelectorAll(
      'a[role="link"][href*="/reel/"], a[role="link"][href*="/videos/"], a[role="link"][href*="/posts/"], abbr'
    );

    for (const a of headerAnchors) {
      if (a.closest('[role="article"]') || a.closest('form')) continue;

      if (a.tagName.toLowerCase() === 'abbr') {
        const title = a.getAttribute('title') || '';
        const txt = a.textContent.trim();
        if (txt) {
          const formatted = Parser.formatTimeAgo(txt);
          if (formatted !== 'Recent') return formatted;
        }
        if (title) {
          const formatted = Parser.formatTimeAgo(title);
          if (formatted !== 'Recent') return formatted;
        }
      }

      const aria = (a.getAttribute('aria-label') || '').trim();
      if (aria && aria.length < 40 && !/(like|comment|share|follow|ফলো|লাইক|মন্তব্য)/i.test(aria)) {
        const formatted = Parser.formatTimeAgo(aria);
        if (formatted !== 'Recent') return formatted;
      }

      const text = (a.textContent || '').trim();
      if (text && text.length < 30 && !/(like|comment|share|follow|ফলো|লাইক|মন্তব্য)/i.test(text)) {
        const formatted = Parser.formatTimeAgo(text);
        if (formatted !== 'Recent') return formatted;
      }
    }

    // 4. Broader header search: spans adjacent to author header or dot separator (·)
    const allSpans = document.querySelectorAll('span[dir="auto"]');
    for (const s of allSpans) {
      if (s.closest('[role="article"]') || s.closest('form') || s.closest('button') || s.closest('[role="button"]')) {
        continue;
      }
      const t = (s.textContent || '').trim();
      if (t.length < 25 && /^(?:[০-৯0-9]+\s*(?:h|hr|hrs|hours?|d|days?|w|wks|weeks?|m|mo|mos|months?|y|yrs|years?|ঘণ্টা|দিন|মাস|বছর)|yesterday|just now|এইমাত্র|গতকাল)/i.test(t)) {
        const formatted = Parser.formatTimeAgo(t);
        if (formatted !== 'Recent') return formatted;
      }
    }

    return 'Recent';
  },

  /**
   * Closes active Reel player modal reliably and returns to grid
   */
  async closeReelPlayer() {
    // 1. Click any visible close/back buttons
    const closeButtons = document.querySelectorAll(
      '[aria-label="Close"], [aria-label="close"], [aria-label="বন্ধ করুন"], [aria-label="Back"], [aria-label="ফিরে যান"], div[role="dialog"] div[role="button"][aria-label="Close"], div[role="dialog"] [aria-label*="Close"], div[aria-label="Press Esc to exit"]'
    );
    closeButtons.forEach(btn => {
      try { btn.click(); } catch (e) {}
    });

    // 2. Dispatch Escape key event
    const escEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      which: 27,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(escEvent);
    window.dispatchEvent(escEvent);
    if (document.activeElement) {
      try { document.activeElement.dispatchEvent(escEvent); } catch (e) {}
    }

    // 3. If modal URL is still active after short pause, pop history
    await new Promise(r => setTimeout(r, 150));
    if (window.location.pathname.includes('/reel/')) {
      try {
        window.history.back();
      } catch (e) {}
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReelsExtractor;
}
