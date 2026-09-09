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
   * Identifies the Active Reel Container on the page (isolated player viewport/dialog)
   * Prevents picking up elements from global chat docks, comments, or right-rail suggestions.
   */
  getActiveReelContainer() {
    if (typeof document === 'undefined') return null;

    // 1. Check if an active modal dialog is present
    const dialog = document.querySelector('div[role="dialog"]');
    if (dialog && dialog.querySelector('video')) {
      return dialog;
    }

    // 2. Identify by active <video> element
    const videos = Array.from(document.querySelectorAll('video'));
    const activeVideo = videos.find(v => !v.paused && v.currentTime > 0) || videos[0];

    if (activeVideo) {
      const d = activeVideo.closest('div[role="dialog"]');
      if (d) return d;

      const pagelet = activeVideo.closest('div[data-pagelet*="Reel"], div[data-pagelet*="Watch"]');
      if (pagelet) return pagelet;

      // Find closest ancestor containing both video and action buttons
      let curr = activeVideo.parentElement;
      for (let i = 0; i < 8 && curr && curr !== document.body; i++) {
        if (curr.querySelector('div[role="toolbar"], div[role="button"][aria-label*="like" i], div[role="button"][aria-label*="share" i]')) {
          return curr;
        }
        curr = curr.parentElement;
      }

      const main = activeVideo.closest('div[role="main"]');
      if (main) return main;
    }

    return document.querySelector('div[role="dialog"]') ||
           document.querySelector('div[data-pagelet*="Reel"]') ||
           document.querySelector('div[role="main"]') ||
           document.body;
  },

  /**
   * Scrapes the active Reel inside Facebook's Reel Player modal
   * @param {string|null} targetId
   * @param {string|null} targetUrl
   * @param {Object|null} pageAuthorInfo
   * @returns {Object}
   */
  scrapeActivePlayer(targetId = null, targetUrl = null, pageAuthorInfo = null) {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const cleanUrl = targetUrl || Parser.cleanUrl(currentUrl);
    let id = Parser.extractId(cleanUrl).replace(/^reel_/, '');
    if (!id && targetId) id = targetId;

    // Auto-mute video to prevent blaring audio during automated scraping
    const video = typeof document !== 'undefined' ? document.querySelector('video') : null;
    if (video) {
      video.muted = true;
    }

    // Isolate active reel container
    const activeContainer = this.getActiveReelContainer();

    // 1. Author Name, Handle, and Avatar (with fallback to page author)
    const authorInfo = this.extractAuthorInfo(pageAuthorInfo, activeContainer);

    // 2. Expand "...more" / "আরও দেখুন" if caption is collapsed
    this.expandCaptionIfCollapsed(activeContainer);

    // 3. Extract Full Content / Caption (strictly excluding chat docks and comments!)
    const content = this.extractPlayerCaption(activeContainer, id, authorInfo.name);

    // 4. Extract Engagement Metrics (Reactions, Comments, Shares, Views)
    const metrics = this.extractPlayerMetrics(id, activeContainer);

    // 5. Media URL & Video Info
    const mediaInfo = this.extractPlayerMedia(id, activeContainer);

    // 6. Posted At Date
    const postedAt = this.extractPlayerPostedDate(id, activeContainer);

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
  extractAuthorInfo(pageAuthorInfo = null, activeContainer = null) {
    let name = '';
    let handle = '';
    let id = '';
    let avatar = '';
    let verified = false;

    const root = activeContainer || (typeof document !== 'undefined' ? document : null);
    if (root) {
      // Search author headers in player
      const authorLinks = root.querySelectorAll('a[role="link"]');
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
    }

    // Fallback to page-level author info
    if (!name && pageAuthorInfo) {
      name = pageAuthorInfo.name || '';
      handle = pageAuthorInfo.handle || '';
      avatar = pageAuthorInfo.avatar || '';
      verified = pageAuthorInfo.verified || false;
    }

    if (!name && typeof window !== 'undefined') {
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

    if (typeof document !== 'undefined') {
      const verifiedBadge = document.querySelector('[aria-label*="Verified"], [aria-label*="ভেরিফাইড"], svg[aria-label*="Verified"]');
      if (verifiedBadge) {
        verified = true;
      }
    }

    return { name, handle, id, avatar, verified };
  },

  /**
   * Automatically clicks "...more" / "...আরও দেখুন" in the reel viewer to expand the full caption
   */
  expandCaptionIfCollapsed(activeContainer = null) {
    const root = activeContainer || this.getActiveReelContainer();
    if (!root) return;

    const expandButtons = root.querySelectorAll('div[role="button"], span[role="button"], a[role="button"], [role="button"]');
    expandButtons.forEach(btn => {
      // Must NOT be in comments or chat
      if (
        btn.closest('[role="article"]') ||
        btn.closest('form') ||
        btn.closest('[role="complementary"]') ||
        btn.closest('[role="region"]') ||
        btn.closest('[aria-label*="Chat" i]') ||
        btn.closest('[aria-label*="Messenger" i]')
      ) {
        return;
      }

      const txt = (btn.textContent || '').trim().toLowerCase();
      if (
        txt === 'more' || txt === '...more' || txt === '…more' ||
        txt === 'see more' || txt === '...see more' || txt === '…see more' ||
        txt === 'show more' || txt === '...show more' || txt === '…show more' ||
        txt === 'আরও দেখুন' || txt === '...আরও' || txt === '…আরও' || txt === 'আরও' ||
        txt.includes('see more') || txt.includes('show more') || txt.includes('আরও দেখুন')
      ) {
        try { btn.click(); } catch (e) {}
      }
    });
  },

  /**
   * Cleans text and strips any button artifacts like "See more", "Show more", "Show less", etc.
   * Handles unicode horizontal ellipsis (\u2026), multiple dots, line breaks, and spaces.
   */
  cleanCaptionText(text) {
    if (!text) return '';
    let str = text;
    // Multi-pass removal of trailing button phrases
    const buttonTrailingRegex = /(?:[\s\.\u2026\u00a0]*)(?:see\s*more|show\s*more|show\s*less|see\s*less|more|less|আরও\s*দেখুন|কম\s*দেখুন)[\s\.\u2026\u00a0]*$/gi;
    let prev = '';
    while (str !== prev) {
      prev = str;
      str = str.replace(buttonTrailingRegex, '').trim();
    }
    // Also remove if on a line by itself
    str = str.replace(/\n\s*(?:see\s*more|show\s*more|show\s*less|see\s*less|more|less|আরও\s*দেখুন|কম\s*দেখুন)\s*$/gi, '').trim();
    // Remove trailing ellipsis, dots, or non-breaking spaces
    str = str.replace(/[\s\.\u2026\u00a0]+$/, '').trim();
    return Parser.cleanText(str);
  },

  /**
   * Scans Facebook Relay JSON script tags for authentic caption / message
   * Returns exact full post text without DOM truncation
   */
  extractCaptionFromRelay(reelId) {
    if (!reelId || typeof document === 'undefined') return null;
    try {
      const scripts = document.querySelectorAll('script[type="application/json"]');
      for (const script of scripts) {
        const content = script.textContent;
        if (!content || !content.includes(reelId)) continue;

        // 1. "message": { "text": "..." }
        const mMsg = content.match(/["']message["']\s*:\s*\{\s*["']text["']\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (mMsg && mMsg[1]) {
          try {
            return JSON.parse(`"${mMsg[1]}"`);
          } catch (e) {
            return mMsg[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
          }
        }

        // 2. "savable_description": { "text": "..." }
        const mDesc = content.match(/["']savable_description["']\s*:\s*\{\s*["']text["']\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (mDesc && mDesc[1]) {
          try {
            return JSON.parse(`"${mDesc[1]}"`);
          } catch (e) {
            return mDesc[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
          }
        }
      }
    } catch (e) {
      console.warn('[FB-Collector] Relay caption extraction error:', e);
    }
    return null;
  },

  /**
   * Extracts full caption text from active player
   * STRICTLY excludes comments, chat windows/docks, and navigation.
   */
  extractPlayerCaption(activeContainer = null, reelId = null, authorName = '') {
    // 1. TIER 1: Check Relay script tags for authentic exact message/caption
    if (reelId) {
      const relayText = this.extractCaptionFromRelay(reelId);
      if (relayText && relayText.length > 0) {
        return this.cleanCaptionText(relayText);
      }
    }

    // 2. TIER 2: Active Reel Container DOM search
    const root = activeContainer || this.getActiveReelContainer();
    if (!root) return '';

    // Blacklist all comment elements, chat tabs, complementaries, and forms
    const blacklistRoots = root.querySelectorAll(
      '[role="article"], form, ul, [role="complementary"], [role="region"], [role="navigation"], [role="banner"], ' +
      '[aria-label*="Chat" i], [aria-label*="Messenger" i], [aria-label*="Message" i], [aria-label*="Comment" i], [aria-label*="মন্তব্য" i], ' +
      'div[data-pagelet*="ChatTab"], div[data-pagelet*="Messenger"]'
    );
    const blacklisted = new Set();
    blacklistRoots.forEach(b => {
      blacklisted.add(b);
      b.querySelectorAll('*').forEach(child => blacklisted.add(child));
    });

    // Also check document-level chat docks and comments to ensure no stray elements leak in
    if (typeof document !== 'undefined') {
      const docChatRoots = document.querySelectorAll(
        '[role="region"][aria-label*="Chat" i], [role="region"][aria-label*="Messenger" i], div[data-pagelet*="ChatTab"], div[data-pagelet*="Messenger"]'
      );
      docChatRoots.forEach(b => {
        blacklisted.add(b);
        b.querySelectorAll('*').forEach(child => blacklisted.add(child));
      });
    }

    // A. PRIORITY: Search from author element within activeContainer
    let authorEl = null;
    const authorLinks = root.querySelectorAll('a[role="link"]');
    for (const a of authorLinks) {
      if (blacklisted.has(a)) continue;
      const t = (a.textContent || '').trim();
      if (authorName && t.toLowerCase() === authorName.toLowerCase()) {
        authorEl = a;
        break;
      }
      if (t.length > 2 && !/(reels|watch|explore|feed|home|ফলো|follow)/i.test(t)) {
        const href = a.getAttribute('href') || '';
        if (!href.includes('/reel/') && !href.includes('/watch') && !href.includes('/hashtag/') && href.length > 15) {
          authorEl = a;
          break;
        }
      }
    }

    if (authorEl) {
      let infoCard = authorEl.parentElement;
      for (let depth = 0; depth < 5 && infoCard && infoCard !== root; depth++) {
        const nodes = infoCard.querySelectorAll('div[dir="auto"], span[dir="auto"]');
        for (const node of nodes) {
          if (blacklisted.has(node)) continue;
          if (node.closest('[role="button"]') || node.closest('[role="toolbar"]') || node.closest('a[role="link"]')) continue;
          if (node.closest('[aria-label*="audio" i], [aria-label*="music" i], [aria-label*="গান" i]')) continue;

          const text = (node.innerText || node.textContent || '').trim();
          if (!text || text.length < 3) continue;
          if (authorName && text.toLowerCase() === authorName.toLowerCase()) continue;
          if (/^(like|comment|share|follow|views|view|ফলো|লাইক|মন্তব্য|শেয়ার|original audio|audio|sound|অরিজিনাল অডিও)$/i.test(text)) continue;
          if (/(original audio|original sound|অরিজিনাল অডিও|অরিজিনাল সাউন্ড)/i.test(text) && text.length < 40) continue;
          if (/^[০-৯0-9.,KMBkmbহাজারলাখকোটি]+$/.test(text)) continue;
          if (/^(?:[0-9]+[hd]|yesterday|just now|Recent|এইমাত্র|গতকাল)/i.test(text) && text.length < 20) continue;
          if (/(assalamu\s*alaikum|thanks for your interest|reply to|chat with)/i.test(text) && text.includes('Tanvir')) continue;

          const cleaned = this.cleanCaptionText(text);
          if (cleaned.length > 0) {
            return cleaned;
          }
        }
        infoCard = infoCard.parentElement;
      }
    }

    // B. Candidate traversal strictly scoped to root (active container)
    const candidateNodes = root.querySelectorAll('div[dir="auto"], span[dir="auto"]');
    let bestCaption = '';

    for (const node of candidateNodes) {
      if (blacklisted.has(node)) continue;
      if (
        node.closest('[role="article"]') ||
        node.closest('form') ||
        node.closest('ul') ||
        node.closest('[role="button"]') ||
        node.closest('[role="toolbar"]') ||
        node.closest('[role="complementary"]') ||
        node.closest('[role="region"]') ||
        node.closest('[aria-label*="Chat" i]') ||
        node.closest('[aria-label*="Messenger" i]') ||
        node.closest('[aria-label*="Comment" i]') ||
        node.closest('[aria-label*="মন্তব্য"]') ||
        node.closest('[aria-label*="audio" i], [aria-label*="music" i], [aria-label*="গান" i]')
      ) {
        continue;
      }

      const text = (node.innerText || node.textContent || '').trim();
      if (!text || text.length < 3) continue;
      if (authorName && text.toLowerCase() === authorName.toLowerCase()) continue;

      if (/^(like|comment|share|follow|views|view|ফলো|লাইক|মন্তব্য|শেয়ার|original audio|original sound|audio|sound|অরিজিনাল অডিও)$/i.test(text)) continue;
      if (/(original audio|original sound|অরিজিনাল অডিও|অরিজিনাল সাউন্ড)/i.test(text) && text.length < 40) continue;
      if (/^[০-৯0-9.,KMBkmbহাজারলাখকোটি]+$/.test(text)) continue;
      if (/^(?:[0-9]+[hd]|yesterday|just now|Recent|এইমাত্র|গতকাল)/i.test(text) && text.length < 20) continue;
      if (/(assalamu\s*alaikum|thanks for your interest|reply to|chat with)/i.test(text) && text.includes('Tanvir')) continue;

      if (text.length > bestCaption.length && !/(like|comment|share|reels|follow|ফলো|লাইক|মন্তব্য)/i.test(text)) {
        bestCaption = text;
      }
    }

    if (bestCaption) {
      return this.cleanCaptionText(bestCaption);
    }

    // C. Meta tag fallback
    if (typeof document !== 'undefined') {
      const metaDesc = document.querySelector('meta[property="og:description"]');
      if (metaDesc && metaDesc.content) {
        const desc = metaDesc.content.trim();
        if (!desc.includes('Watch the latest reel') && !desc.includes('Facebook')) {
          return this.cleanCaptionText(desc);
        }
      }
    }

    return '';
  },

  /**
   * Scans Facebook Relay JSON script tags for exact metrics and timestamps
   * STRICT: ONLY inspects scripts that explicitly reference reelId!
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

    if (!reelId || typeof document === 'undefined') return data;

    try {
      const scripts = document.querySelectorAll('script[type="application/json"]');
      if (!scripts || scripts.length === 0) return data;

      for (const script of scripts) {
        const content = script.textContent;
        if (!content || !content.includes(reelId)) {
          continue; // MUST belong to THIS reel
        }

        // 1. Reactions
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

        // 2. Comments
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

        // 3. Shares
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
   * Helper to extract numerical count from an action button (Like, Comment, Share)
   * Examines aria-label, inner text, sibling spans, and parent container.
   */
  extractCountFromActionButton(btn) {
    if (!btn) return 0;

    // 1. Check aria-label directly (e.g. "3.8K reactions", "41 comments", "74 shares")
    const aria = (btn.getAttribute('aria-label') || '').trim();
    if (aria && !/(?:play|pause|volume|mute|close|back|more options|next|previous|reply)/i.test(aria)) {
      const ariaNum = Parser.parseMetric(aria);
      if (ariaNum > 0) return ariaNum;
    }

    // 2. Check inner text or spans inside the button
    const innerSpans = btn.querySelectorAll('span, div');
    for (const s of innerSpans) {
      const txt = (s.innerText || s.textContent || '').trim();
      if (txt && txt.length < 35 && !/^[0-9]+:[0-9]+/.test(txt) && !/(?:ago|ঘণ্টা|দিন|view|ভিউ)/i.test(txt)) {
        const val = Parser.parseMetric(txt);
        if (val > 0) return val;
      }
    }

    // 3. Check sibling element (very common layout: button icon is above count span)
    let sibling = btn.nextElementSibling;
    while (sibling) {
      const txt = (sibling.innerText || sibling.textContent || '').trim();
      if (txt && txt.length < 35 && !/^[0-9]+:[0-9]+/.test(txt) && !/(?:ago|ঘণ্টা|দিন|view|ভিউ)/i.test(txt)) {
        const val = Parser.parseMetric(txt);
        if (val > 0) return val;
      }
      sibling = sibling.nextElementSibling;
    }

    // 4. Check parent container's child spans and parent full text
    const parent = btn.parentElement;
    if (parent) {
      const parentSpans = parent.querySelectorAll('span, div');
      for (const s of parentSpans) {
        if (btn.contains(s)) continue;
        const txt = (s.innerText || s.textContent || '').trim();
        if (txt && txt.length < 35 && !/^[0-9]+:[0-9]+/.test(txt) && !/(?:ago|ঘণ্টা|দিন|view|ভিউ)/i.test(txt)) {
          const val = Parser.parseMetric(txt);
          if (val > 0) return val;
        }
      }

      // Check parent's full text
      const parentText = (parent.innerText || parent.textContent || '').trim();
      if (parentText && parentText.length < 40 && !/^[0-9]+:[0-9]+/.test(parentText) && !/(?:ago|ঘণ্টা|দিন|view|ভিউ)/i.test(parentText)) {
        const val = Parser.parseMetric(parentText);
        if (val > 0) return val;
      }
    }

    return 0;
  },

  /**
   * Extracts reaction, comment, share, and view counts from active player
   * STRICTLY reads authentic metrics from the visible action toolbar inside the active container.
   * NEVER queries global document buttons to prevent picking up stray recommendation counts.
   */
  extractPlayerMetrics(reelId, activeContainer = null) {
    let reactions = 0;
    let comments = 0;
    let shares = 0;
    let views = this.gridViewsMap.get(reelId) || 0;

    // 1. Check Relay scripts for authoritative metrics first
    if (reelId) {
      const relay = this.extractFromRelayScripts(reelId);
      if (relay) {
        if (relay.reactions > 0) reactions = relay.reactions;
        if (relay.comments > 0) comments = relay.comments;
        if (relay.shares > 0) shares = relay.shares;
        if (relay.views > 0 && views === 0) views = relay.views;
      }
    }

    const root = activeContainer || this.getActiveReelContainer();
    if (!root) return { reactions, comments, shares, views };

    // 2. STRATEGY 1: Dedicated Reel Action Toolbar inside active container
    let foundToolbarWithShare = false;
    const toolbarContainers = root.querySelectorAll(
      'div[role="toolbar"], div[data-pagelet*="Reel"] div, div[role="main"] div'
    );

    for (const container of toolbarContainers) {
      // Must not be inside comments, chat docks, or forms
      if (
        container.closest('[role="article"]') ||
        container.closest('form') ||
        container.closest('[role="complementary"]') ||
        container.closest('[role="region"]') ||
        container.closest('[aria-label*="Chat" i]')
      ) {
        continue;
      }

      const likeBtn = container.querySelector(
        'div[role="button"][aria-label*="like" i], div[role="button"][aria-label*="লাইক" i], div[role="button"][aria-label*="reaction" i], div[role="button"][aria-label*="react" i], div[role="button"][aria-label*="love" i], span[role="button"][aria-label*="like" i]'
      );
      const commentBtn = container.querySelector(
        'div[role="button"][aria-label*="comment" i], div[role="button"][aria-label*="মন্তব্য" i], span[role="button"][aria-label*="comment" i]'
      );
      const shareBtn = container.querySelector(
        'div[role="button"][aria-label*="share" i], div[role="button"][aria-label*="শেয়ার" i], div[role="button"][aria-label*="শেয়ার" i], div[role="button"][aria-label*="send this" i], span[role="button"][aria-label*="share" i]'
      );

      if (likeBtn || commentBtn || shareBtn) {
        if (likeBtn && reactions === 0) {
          reactions = this.extractCountFromActionButton(likeBtn);
        }
        if (commentBtn && comments === 0) {
          comments = this.extractCountFromActionButton(commentBtn);
        }
        if (shareBtn) {
          foundToolbarWithShare = true;
          if (shares === 0) {
            shares = this.extractCountFromActionButton(shareBtn);
            // If share button is present and displays no number, it is authentically 0!
          }
        }

        if (reactions > 0 || comments > 0 || shares > 0 || foundToolbarWithShare) {
          break;
        }
      }
    }

    // 3. STRATEGY 2: Scoped Action Buttons inside active container ONLY (never global document)
    // Only search for shares if no toolbar with a share button was found
    if (reactions === 0 || comments === 0 || (!foundToolbarWithShare && shares === 0)) {
      const actionButtons = root.querySelectorAll(
        'div[role="button"][aria-label], span[role="button"][aria-label], a[role="button"][aria-label]'
      );

      actionButtons.forEach(btn => {
        if (
          btn.closest('[role="article"]') ||
          btn.closest('form') ||
          btn.closest('[role="complementary"]') ||
          btn.closest('[role="region"]') ||
          btn.closest('[aria-label*="Chat" i]')
        ) {
          return;
        }

        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();

        // Likes / Reactions
        if (reactions === 0 && /(?:like|reaction|লাইক|প্রতিক্রিয়া|react\b|love\b)/i.test(aria)) {
          if (!/(?:unlike|dislike|reply)/i.test(aria)) {
            const val = this.extractCountFromActionButton(btn);
            if (val > 0) reactions = val;
          }
        }

        // Comments
        if (comments === 0 && /(?:comment|মন্তব্য)/i.test(aria)) {
          if (!/(?:write|close|reply|comment as)/i.test(aria)) {
            const val = this.extractCountFromActionButton(btn);
            if (val > 0) comments = val;
          }
        }

        // Shares - ONLY if foundToolbarWithShare is false
        if (!foundToolbarWithShare && shares === 0 && /(?:share|শেয়ার|শেয়ার|send this to friends)/i.test(aria)) {
          const val = this.extractCountFromActionButton(btn);
          if (val > 0) shares = val;
        }
      });
    }

    // 4. STRATEGY 3: Comments Drawer Header scan (scoped to active container)
    if (comments === 0) {
      const commentHeaders = root.querySelectorAll('h2, h3, span[dir="auto"], div[dir="auto"]');
      for (const el of commentHeaders) {
        if (el.closest('form') || el.closest('button') || el.closest('[role="region"]')) continue;
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

    // 5. STRATEGY 4: Views fallback from active container if still 0
    if (views === 0) {
      const viewNodes = root.querySelectorAll('span, div');
      for (const node of viewNodes) {
        if (node.closest('[role="article"]') || node.closest('form') || node.closest('[role="region"]')) continue;
        const t = (node.textContent || '').trim();
        if (/(?:views|view|ভিউ|বার দেখা হয়েছে|plays|প্লে)/i.test(t) && t.length < 30) {
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
  extractPlayerMedia(reelId = null, activeContainer = null) {
    let mediaUrl = '';
    let thumbnail = '';
    let videoLength = 'N/A';

    const root = activeContainer || this.getActiveReelContainer();

    // 1. Check Relay JSON scripts first
    if (reelId) {
      const relay = this.extractFromRelayScripts(reelId);
      if (relay && relay.videoLengthSec > 0) {
        videoLength = Parser.formatVideoDuration(relay.videoLengthSec);
      }
    }

    // 2. Check HTML5 <video> element
    const video = root ? root.querySelector('video') : (typeof document !== 'undefined' ? document.querySelector('video') : null);
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
    if (videoLength === 'N/A' && root) {
      const progress = root.querySelector('div[role="progressbar"], div[aria-valuemax]');
      if (progress) {
        const max = parseFloat(progress.getAttribute('aria-valuemax'));
        if (!isNaN(max) && max > 0 && max < 7200 && max !== 100) {
          videoLength = Parser.formatVideoDuration(max);
        }
      }
    }

    // 4. Check time text in player controls (e.g. "0:15 / 3:05")
    if (videoLength === 'N/A' && root) {
      const timeSpans = root.querySelectorAll('span, div');
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

    if (!thumbnail && root) {
      const img = root.querySelector('img[src*="scontent"], img[src*="fbcdn"]');
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
  extractPlayerPostedDate(reelId = null, activeContainer = null) {
    // 1. Check Relay JSON scripts for exact creation_time / publish_time
    if (reelId) {
      const relay = this.extractFromRelayScripts(reelId);
      if (relay && relay.creationTime) {
        return Parser.formatTimeAgo(relay.creationTime);
      }
    }

    // 2. Check meta article:published_time
    if (typeof document !== 'undefined') {
      const metaDate = document.querySelector('meta[property="article:published_time"]');
      if (metaDate && metaDate.content) {
        const relative = Parser.formatTimeAgo(metaDate.content);
        if (relative && relative !== 'Recent') {
          return relative;
        }
      }
    }

    const root = activeContainer || this.getActiveReelContainer();
    if (!root) return 'Recent';

    // 3. Search header timestamp anchors and spans near author
    const headerAnchors = root.querySelectorAll(
      'a[role="link"][href*="/reel/"], a[role="link"][href*="/videos/"], a[role="link"][href*="/posts/"], abbr'
    );

    for (const a of headerAnchors) {
      if (
        a.closest('[role="article"]') ||
        a.closest('form') ||
        a.closest('[role="region"]') ||
        a.closest('[aria-label*="Chat" i]')
      ) {
        continue;
      }

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
    const allSpans = root.querySelectorAll('span[dir="auto"]');
    for (const s of allSpans) {
      if (
        s.closest('[role="article"]') ||
        s.closest('form') ||
        s.closest('button') ||
        s.closest('[role="button"]') ||
        s.closest('[role="region"]') ||
        s.closest('[aria-label*="Chat" i]')
      ) {
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
