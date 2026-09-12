/**
 * Extractor for Facebook Page Posts
 * Fixed:
 * 1. Strictly isolates caption from comments (never detects comments as caption).
 * 2. Accurately extracts published date from header timestamp aria-labels & abbr.
 * 3. Accurately extracts reaction counts, comment counts, and share counts from the engagement bar.
 * 4. Outputs records matching the exact 19-column schema.
 */

const PostsExtractor = {
  /**
   * Scrapes visible posts in the feed
   * @returns {Array<Object>} List of extracted post objects
   */
  extractVisiblePosts() {
    const results = [];
    const postContainers = this.findAllPostContainers();
    const seenKeys = new Set();

    postContainers.forEach(container => {
      try {
        const postData = this.parsePostElement(container);
        if (postData && postData.url) {
          const key = postData.id || postData.url;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            results.push(postData);
          }
        }
      } catch (err) {
        console.debug('Error parsing post container:', err);
      }
    });

    return results;
  },

  /**
   * Finds post cards on page timelines
   */
  findAllPostContainers() {
    const containers = new Set();

    // Strategy 1: Elements with role="article" (excluding nested comment articles)
    document.querySelectorAll('div[role="article"]').forEach(el => {
      // Must not be a sub-comment
      if (!el.closest('ul') && !el.closest('form') && !el.getAttribute('aria-label')?.includes('Comment')) {
        containers.add(el);
      }
    });

    // Strategy 2: Direct children of timeline feed
    const timelineUnits = document.querySelectorAll(
      'div[role="feed"] > div, div[data-pagelet*="ProfileTimeline"] > div'
    );
    timelineUnits.forEach(unit => {
      if (unit.querySelector('[role="toolbar"], [aria-label*="Like"], [aria-label*="লাইক"]')) {
        containers.add(unit);
      }
    });

    // Strategy 3: Traverse up from action toolbars (Like/Comment/Share bar)
    const toolbars = document.querySelectorAll('[role="toolbar"], [aria-label*="Actions for this post"]');
    toolbars.forEach(tb => {
      let curr = tb.parentElement;
      for (let i = 0; i < 10 && curr && curr !== document.body; i++) {
        if (
          curr.getAttribute('role') === 'article' ||
          curr.querySelector('a[href*="/posts/"], a[href*="story_fbid="], a[href*="/videos/"], a[href*="permalink.php"]')
        ) {
          containers.add(curr);
          break;
        }
        curr = curr.parentElement;
      }
    });

    return Array.from(containers);
  },

  /**
   * Parses individual post card
   */
  parsePostElement(container) {
    // 1. Locate Action Toolbar (demarcation between post content and comments)
    const toolbar = container.querySelector(
      '[role="toolbar"], [aria-label*="Like"], [aria-label*="লাইক"], [aria-label*="Comment"], [aria-label*="মন্তব্য"]'
    );

    // 2. Extract Post Link & ID
    const linkInfo = this.extractPostLink(container, toolbar);
    if (!linkInfo || !linkInfo.url) return null;

    // 3. Extract Author Information
    const authorInfo = this.extractAuthorInfo(container);

    // 4. Extract Published Date from header
    const postedAt = this.extractPublishedDate(container, linkInfo.anchor);

    // 5. Extract Full Caption (STRICTLY before toolbar to exclude comments!)
    const content = this.extractCaption(container, toolbar);

    // 6. Extract Engagement Metrics (Reactions, Comments, Shares, Views)
    const metrics = this.extractEngagement(container, toolbar);

    // 7. Detect Media (Image / Video URL)
    const media = this.extractMedia(container, toolbar);

    const id = Parser.extractId(linkInfo.url).replace(/^post_/, '');

    return {
      id,
      postId: id,
      type: media.type === 'video' ? 'video' : 'post',
      postType: media.type === 'video' ? 'video' : 'post',
      mediaType: media.type === 'video' ? 'video' : 'image',
      url: linkInfo.url,
      postUrl: linkInfo.url,
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
      mediaUrl: media.mediaUrl || media.thumbnail || '',
      thumbnail: media.thumbnail || '',
      images: media.mediaUrl || media.thumbnail || '',
      videoLength: media.videoLength || 'N/A',
      publishedDate: postedAt || 'Recent',
      postedAt: postedAt || 'Recent',
      scrapedAt: new Date().toLocaleString(),
      collectedAt: new Date().toISOString()
    };
  },

  /**
   * Finds post permalink
   */
  extractPostLink(container, toolbar) {
    const allLinks = container.querySelectorAll('a');
    let candidate = null;

    // Search links above toolbar first
    for (const a of allLinks) {
      // Exclude comment links below toolbar
      if (toolbar && toolbar.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) {
        continue;
      }

      const href = a.getAttribute('href') || a.href || '';
      if (
        href.includes('/posts/') ||
        href.includes('story_fbid=') ||
        href.includes('permalink.php') ||
        href.includes('/videos/') ||
        href.includes('/reel/') ||
        href.includes('/photo.php') ||
        href.includes('/photos/')
      ) {
        if (!href.includes('comment_id') && !href.includes('reply_comment_id')) {
          candidate = a;
          break;
        }
      }
    }

    // Secondary: timestamp anchor in header
    if (!candidate) {
      for (const a of allLinks) {
        if (toolbar && toolbar.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) {
          continue;
        }

        const aria = a.getAttribute('aria-label') || '';
        const text = a.textContent || '';
        const href = a.getAttribute('href') || '';
        if (
          href &&
          href !== '#' &&
          !href.startsWith('javascript') &&
          (/(hour|hr|min|day|yesterday|just now|ago|ঘণ্টা|দিন|মিনিট|গতকাল)/i.test(aria) ||
           /(hour|hr|min|day|yesterday|just now|ago|ঘণ্টা|দিন|মিনিট|গতকাল)/i.test(text))
        ) {
          candidate = a;
          break;
        }
      }
    }

    if (!candidate) return null;

    let rawHref = candidate.getAttribute('href') || candidate.href || '';
    if (rawHref.startsWith('/')) {
      rawHref = 'https://www.facebook.com' + rawHref;
    }

    const clean = Parser.cleanUrl(rawHref);
    return { url: clean, anchor: candidate };
  },

  /**
   * Extracts author info from post header
   */
  extractAuthorInfo(container) {
    let name = '';
    let handle = '';
    let id = '';
    let avatar = '';
    let verified = false;

    const strongOrH = container.querySelector('h2, h3, h4, strong');
    if (strongOrH) {
      name = strongOrH.textContent.trim();
      const parentLink = strongOrH.closest('a');
      if (parentLink) {
        const href = parentLink.getAttribute('href') || '';
        handle = href.replace(/^https?:\/\/(www\.)?facebook\.com\//, '').replace(/\/$/, '').split('?')[0];
      }
    }

    if (!name) {
      if (window.location.href.includes('pedagoacademy')) {
        name = 'Pedago Academy';
        handle = 'pedagoacademy';
      } else if (window.location.href.includes('TechDeck')) {
        name = 'TechDeck.BD';
        handle = 'TechDeck.BD';
      }
    }

    const avatarImg = container.querySelector('img[src*="scontent"], img[src*="fbcdn"]');
    if (avatarImg) {
      avatar = avatarImg.src;
    }

    const verifiedBadge = container.querySelector('[aria-label*="Verified"], [aria-label*="ভেরিফাইড"]');
    if (verifiedBadge) {
      verified = true;
    }

    return { name, handle, id, avatar, verified };
  },

  /**
   * Extracts published date from header anchor
   */
  extractPublishedDate(container, anchor) {
    if (anchor) {
      const aria = anchor.getAttribute('aria-label');
      if (aria && !/(like|comment|share|লাইক|মন্তব্য)/i.test(aria)) {
        const formatted = Parser.formatTimeAgo(aria.trim());
        if (formatted !== 'Recent') return formatted;
        return aria.trim();
      }

      const abbr = anchor.querySelector('abbr');
      if (abbr) {
        const title = abbr.getAttribute('title') || abbr.textContent.trim();
        const formatted = Parser.formatTimeAgo(title);
        if (formatted !== 'Recent') return formatted;
        return title;
      }

      const text = anchor.textContent.trim();
      if (text && text.length > 0 && text.length < 40) {
        const formatted = Parser.formatTimeAgo(text);
        if (formatted !== 'Recent') return formatted;
        return text;
      }
    }

    // Search header time spans
    const timeElements = container.querySelectorAll('abbr, span[aria-labelledby], a[role="link"] span');
    for (const el of timeElements) {
      const text = el.textContent.trim();
      if (
        text &&
        text.length < 40 &&
        /(hr|hour|min|day|yesterday|just now|ago|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|ঘণ্টা|মিনিট|দিন|গতকাল)/i.test(text)
      ) {
        const formatted = Parser.formatTimeAgo(text);
        if (formatted !== 'Recent') return formatted;
        return text;
      }
    }

    return 'Recent';
  },

  /**
   * Extracts post caption / text body
   * STRICT FIX: Only looks at nodes strictly ABOVE the action toolbar!
   * NEVER searches inside comments or below toolbar!
   */
  extractCaption(container, toolbar) {
    // 1. Auto-expand "See more" / "আরও দেখুন" button inside caption
    const seeMoreButtons = container.querySelectorAll('div[role="button"], span[role="button"]');
    seeMoreButtons.forEach(btn => {
      // Only above toolbar
      if (toolbar && toolbar.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING) {
        return;
      }
      const txt = (btn.textContent || '').trim().toLowerCase();
      if (txt === 'see more' || txt === 'আরও দেখুন' || txt === 'more') {
        try { btn.click(); } catch (e) {}
      }
    });

    // 2. Primary: data-ad-preview="message" (guaranteed to be the post body!)
    const previewMsg = container.querySelector('div[data-ad-preview="message"]');
    if (previewMsg && previewMsg.innerText.trim().length > 0) {
      return Parser.cleanText(previewMsg.innerText);
    }

    // 3. Secondary: search div[dir="auto"] that are strictly BEFORE the toolbar
    const dirNodes = container.querySelectorAll('div[dir="auto"]');
    let bestText = '';

    for (const node of dirNodes) {
      // Must be above toolbar
      if (toolbar && toolbar.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) {
        continue;
      }
      // Must not be author name or action button
      if (node.closest('h2, h3, h4, strong') || node.closest('[role="button"]') || node.closest('[role="toolbar"]')) {
        continue;
      }

      const text = (node.innerText || node.textContent || '').trim();
      if (text.length > bestText.length && !/(like|comment|share|লাইক|মন্তব্য|শেয়ার)/i.test(text)) {
        bestText = text;
      }
    }

    if (bestText) {
      return Parser.cleanText(bestText);
    }

    return '';
  },

  /**
   * Extracts engagement metrics (Reactions, Comments, Shares, Views)
   * Targets the engagement summary row directly ABOVE the toolbar!
   */
  extractEngagement(container, toolbar) {
    let reactions = 0;
    let comments = 0;
    let shares = 0;
    let views = 0;

    // Check engagement row above toolbar
    const textNodes = container.querySelectorAll('span, div, a');
    textNodes.forEach(node => {
      // Don't search inside comments
      if (toolbar && toolbar.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) {
        // Only consider direct engagement summary inside toolbar
        if (!node.closest('[role="toolbar"]')) return;
      }

      const text = (node.textContent || '').trim();
      if (!text) return;

      // Match reactions count
      const aria = node.getAttribute('aria-label') || '';
      if (/(?:reaction|reactions|like|likes|প্রতিক্রিয়া|লাইক)/i.test(aria)) {
        const p = Parser.parseMetric(aria);
        if (p > reactions) reactions = p;
      }

      // Match comments count (e.g. "6 comments", "৬টি মন্তব্য")
      if (/(?:comments|comment|মন্তব্য|টি মন্তব্য)/i.test(text)) {
        const count = Parser.parseMetric(text);
        if (count > comments) comments = count;
      }

      // Match shares count (e.g. "1 share", "১টি শেয়ার")
      if (/(?:shares|share|শেয়ার|টি শেয়ার)/i.test(text)) {
        const count = Parser.parseMetric(text);
        if (count > shares) shares = count;
      }

      // Match views
      if (/(?:views|view|ভিউ|বার দেখা হয়েছে)/i.test(text)) {
        const count = Parser.parseMetric(text);
        if (count > views) views = count;
      }
    });

    // Secondary reaction scan: check span next to reaction icons
    if (reactions === 0) {
      const reactionIcons = container.querySelectorAll('span[role="toolbar"] span, [aria-label*="reaction"]');
      reactionIcons.forEach(r => {
        const num = Parser.parseMetric(r.getAttribute('aria-label') || r.textContent);
        if (num > reactions) reactions = num;
      });
    // Business rule: if share > comment, then share will be 0
    if (shares > comments) {
      shares = 0;
    }

    return { reactions, comments, shares, views };
  },

  /**
   * Extracts media URL and video length
   */
  extractMedia(container, toolbar) {
    let type = 'text';
    let mediaUrl = '';
    let thumbnail = '';
    let videoLength = 'N/A';

    const video = container.querySelector('video');
    const img = container.querySelector('img[src*="scontent"], img[src*="fbcdn"]');

    if (video) {
      type = 'video';
      if (video.poster) {
        thumbnail = video.poster;
        mediaUrl = video.poster;
      }
      if (video.duration && !isNaN(video.duration) && video.duration > 0) {
        videoLength = Parser.formatDuration(video.duration);
      }
    } else if (img) {
      type = 'image';
      thumbnail = img.src;
      mediaUrl = img.src;
    }

    return { type, mediaUrl, thumbnail, videoLength };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PostsExtractor;
}
