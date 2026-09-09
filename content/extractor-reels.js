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
    const mediaInfo = this.extractPlayerMedia();

    // 6. Posted At Date
    const postedAt = this.extractPlayerPostedDate();

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
   * Extracts reaction, comment, share, and view counts from active player
   */
  extractPlayerMetrics(reelId) {
    let reactions = 0;
    let comments = 0;
    let shares = 0;
    let views = this.gridViewsMap.get(reelId) || 0;

    const actionElements = document.querySelectorAll(
      '[aria-label*="Like"], [aria-label*="reaction"], [aria-label*="Comment"], [aria-label*="Share"], [aria-label*="লাইক"], [aria-label*="মন্তব্য"], [aria-label*="শেয়ার"]'
    );

    actionElements.forEach(el => {
      const aria = el.getAttribute('aria-label') || '';
      const text = (el.textContent || '').trim();
      const parent = el.parentElement;

      let num = Parser.parseMetric(aria);
      if (num === 0 && text) num = Parser.parseMetric(text);
      if (num === 0 && parent) {
        const siblingText = (parent.textContent || '').trim();
        num = Parser.parseMetric(siblingText);
      }

      if (/(?:like|reaction|লাইক|প্রতিক্রিয়া)/i.test(aria) && num > 0) {
        reactions = Math.max(reactions, num);
      }
      if (/(?:comment|মন্তব্য)/i.test(aria) && num > 0) {
        comments = Math.max(comments, num);
      }
      if (/(?:share|শেয়ার)/i.test(aria) && num > 0) {
        shares = Math.max(shares, num);
      }
    });

    if (reactions === 0 || comments === 0) {
      const spans = document.querySelectorAll('span[dir="auto"]');
      spans.forEach(span => {
        const txt = span.textContent.trim();
        if (/^[০-৯0-9]+(?:\.[০-৯0-9]+)?[KMBkmbহাজারলাখকোটি]?$/.test(txt)) {
          const val = Parser.parseMetric(txt);
          const parent = span.parentElement;
          if (parent && (parent.querySelector('svg') || parent.querySelector('i'))) {
            if (reactions === 0) reactions = val;
            else if (comments === 0) comments = val;
            else if (shares === 0) shares = val;
          }
        }
      });
    }

    if (views === 0) {
      const viewNodes = document.querySelectorAll('span, div');
      for (const node of viewNodes) {
        const t = node.textContent.trim();
        if (/(?:views|view|ভিউ|বার দেখা হয়েছে)/i.test(t)) {
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
   * Extracts media URL and video length
   */
  extractPlayerMedia() {
    let mediaUrl = '';
    let thumbnail = '';
    let videoLength = 'N/A';

    const video = document.querySelector('video');
    if (video) {
      if (video.poster) {
        thumbnail = video.poster;
        mediaUrl = video.poster;
      }
      if (video.src && video.src.startsWith('http')) {
        mediaUrl = video.src;
      }
      if (video.duration && !isNaN(video.duration) && video.duration > 0) {
        videoLength = Parser.formatDuration(video.duration);
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
   * Extracts published date from active player
   */
  extractPlayerPostedDate() {
    const metaDate = document.querySelector('meta[property="article:published_time"]');
    if (metaDate && metaDate.content) {
      try {
        const d = new Date(metaDate.content);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch (e) {}
    }

    const anchors = document.querySelectorAll('a[role="link"], span[dir="auto"], abbr');
    for (const a of anchors) {
      if (a.closest('[role="article"]') || a.closest('form')) continue;

      const aria = a.getAttribute('aria-label') || '';
      const text = (a.textContent || '').trim();
      const dateRegex = /(?:hour|hr|min|day|week|month|year|yesterday|just now|ago|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|ঘণ্টা|মিনিট|দিন|সপ্তাহ|মাস|বছর|গতকাল|এইমাত্র|\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b)/i;

      if (aria && aria.length < 40 && !/(like|comment|share|follow|ফলো|লাইক|মন্তব্য)/i.test(aria) && dateRegex.test(aria)) {
        return aria;
      }

      if (text && text.length < 35 && !/(like|comment|share|follow|ফলো|লাইক|মন্তব্য)/i.test(text) && dateRegex.test(text)) {
        return text;
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
