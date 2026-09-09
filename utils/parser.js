/**
 * Utility functions for parsing numbers, metrics, dates, URLs, and video durations.
 * Fully supports English, Bengali (বাংলা), alphanumeric pfbid IDs, and emojis.
 */

const Parser = {
  // Bengali to English digit map
  bnToEnDigits: {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  },

  /**
   * Converts any string containing Bengali digits to standard English digits.
   */
  convertBengaliDigits(str) {
    if (!str) return '';
    return str.replace(/[০-৯]/g, (match) => this.bnToEnDigits[match] || match);
  },

  /**
   * Parse numerical metric from strings like:
   * "1.2K", "3.4M", "52 shares", "100 comments", "১.২ লাখ ভিউ", "৭৫টি মন্তব্য", "২০টি শেয়ার", "12.5K views"
   */
  parseMetric(rawText) {
    if (!rawText) return 0;
    
    let text = rawText.toString().trim();
    // Convert Bengali digits first
    text = this.convertBengaliDigits(text);

    // Check for Bengali suffixes
    let multiplier = 1;
    if (/কোটি|crore/i.test(text)) {
      multiplier = 10000000;
    } else if (/লাখ|lakh/i.test(text)) {
      multiplier = 100000;
    } else if (/হাজার/i.test(text)) {
      multiplier = 1000;
    } else if (/b\b/i.test(text)) {
      multiplier = 1000000000;
    } else if (/m\b/i.test(text)) {
      multiplier = 1000000;
    } else if (/k\b/i.test(text)) {
      multiplier = 1000;
    }

    // Handle European comma decimals with suffix (e.g. 1,5K -> 1.5K)
    text = text.replace(/(\d+),(\d+)(?=[kmbহাজারলাখকোটি])/i, '$1.$2');
    // Remove formatting commas/dots in whole numbers (e.g. 1,245 -> 1245 or 12,345 -> 12345)
    text = text.replace(/(\d+),(\d+)/g, '$1$2');

    // Extract decimal or whole number
    const match = text.match(/([0-9]+(?:\.[0-9]+)?)/);
    if (!match) return 0;

    const num = parseFloat(match[1]);
    if (isNaN(num)) return 0;

    return Math.round(num * multiplier);
  },

  /**
   * Formats a raw number into a neat readable string (e.g., 1250 -> "1.3K", 2500000 -> "2.5M")
   */
  formatCompactNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toLocaleString();
  },

  /**
   * Formats video duration in human-readable style as requested:
   * e.g., 45 -> "45 sec", 185 -> "3 min 5 sec", 1843 -> "30 min 43 sec", 3665 -> "1 hr 1 min 5 sec"
   */
  formatVideoDuration(seconds) {
    if (!seconds || isNaN(seconds) || seconds <= 0) return 'N/A';
    const totalSecs = Math.round(seconds);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    if (hrs > 0) {
      const parts = [`${hrs} hr`];
      if (mins > 0) parts.push(`${mins} min`);
      if (secs > 0) parts.push(`${secs} sec`);
      return parts.join(' ');
    }

    if (mins > 0) {
      if (secs > 0) {
        return `${mins} min ${secs} sec`;
      }
      return `${mins} min`;
    }

    return `${secs} sec`;
  },

  /**
   * Formats video duration from seconds (delegates to formatVideoDuration)
   */
  formatDuration(seconds) {
    return this.formatVideoDuration(seconds);
  },

  /**
   * Formats date or timestamp as a relative time length string:
   * e.g., "5hr ago", "3 days ago", "2 month ago", "1 year ago"
   * Also normalizes DOM shorthands ("5h" -> "5hr ago", "3d" -> "3 days ago", "৫ ঘণ্টা আগে" -> "5hr ago").
   */
  formatTimeAgo(input) {
    if (!input) return 'Recent';

    // 1. If string, check for shorthand / relative phrases
    if (typeof input === 'string') {
      let str = input.trim();

      // Convert Bengali numerals if present
      const converted = this.convertBengaliDigits(str);

      // Bengali phrases
      if (/(?:এইমাত্র|just now)/i.test(str)) return 'Just now';
      if (/গতকাল/i.test(str)) return '1 day ago';
      const bnHourMatch = converted.match(/(\d+)\s*(?:ঘণ্টা|ঘন্টা)\s*(?:আগে)?/i);
      if (bnHourMatch) return `${bnHourMatch[1]}hr ago`;
      const bnDayMatch = converted.match(/(\d+)\s*দিন\s*(?:আগে)?/i);
      if (bnDayMatch) return `${bnDayMatch[1]} days ago`;
      const bnMonthMatch = converted.match(/(\d+)\s*মাস\s*(?:আগে)?/i);
      if (bnMonthMatch) return `${bnMonthMatch[1]} month ago`;
      const bnYearMatch = converted.match(/(\d+)\s*বছর\s*(?:আগে)?/i);
      if (bnYearMatch) return `${bnYearMatch[1]} year ago`;
      const bnMinMatch = converted.match(/(\d+)\s*মিনিট\s*(?:আগে)?/i);
      if (bnMinMatch) return `${bnMinMatch[1]}m ago`;

      // English relative expressions
      if (/^just now$/i.test(str)) return 'Just now';
      if (/^yesterday/i.test(str)) return '1 day ago';

      const hrMatch = str.match(/^(\d+)\s*(?:h|hr|hrs|hours?)\s*(?:ago)?$/i);
      if (hrMatch) return `${hrMatch[1]}hr ago`;

      const dayMatch = str.match(/^(\d+)\s*(?:d|days?)\s*(?:ago)?$/i);
      if (dayMatch) {
        const d = parseInt(dayMatch[1], 10);
        return `${d} ${d === 1 ? 'day' : 'days'} ago`;
      }

      const weekMatch = str.match(/^(\d+)\s*(?:w|wks|weeks?)\s*(?:ago)?$/i);
      if (weekMatch) {
        const w = parseInt(weekMatch[1], 10);
        const days = w * 7;
        return `${days} days ago`;
      }

      const monthMatch = str.match(/^(\d+)\s*(?:m|mo|mos|months?)\s*(?:ago)?$/i);
      if (monthMatch) {
        const m = parseInt(monthMatch[1], 10);
        return `${m} month ago`;
      }

      const yearMatch = str.match(/^(\d+)\s*(?:y|yrs|years?)\s*(?:ago)?$/i);
      if (yearMatch) {
        const y = parseInt(yearMatch[1], 10);
        return `${y} ${y === 1 ? 'year' : 'years'} ago`;
      }

      const minMatch = str.match(/^(\d+)\s*(?:m|min|mins|minutes?)\s*(?:ago)?$/i);
      if (minMatch) return `${minMatch[1]}m ago`;
    }

    // 2. Parse numeric timestamp or Date string
    let dateMs = null;
    if (typeof input === 'number') {
      // If seconds (e.g. 1.7e9), convert to ms
      dateMs = input < 1e11 ? input * 1000 : input;
    } else if (typeof input === 'string') {
      const parsed = Date.parse(input);
      if (!isNaN(parsed)) {
        dateMs = parsed;
      }
    } else if (input instanceof Date) {
      dateMs = input.getTime();
    }

    if (!dateMs) {
      return typeof input === 'string' && input.length < 30 ? input : 'Recent';
    }

    // 3. Compute elapsed difference
    const diffMs = Math.max(0, Date.now() - dateMs);
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}hr ago`;
    if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    if (diffDays < 365) return `${Math.max(1, diffMonths)} month ago`;
    return `${Math.max(1, diffYears)} ${diffYears === 1 ? 'year' : 'years'} ago`;
  },

  /**
   * Decodes HTML entities and common Unicode escape sequences
   */
  decodeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
      .replace(/&#([0-9]+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"');
  },

  /**
   * Cleans Facebook URLs by stripping tracking and analytics parameters
   * Returns clean, canonical permalinks suitable for sharing.
   */
  cleanUrl(rawUrl) {
    if (!rawUrl) return '';
    try {
      // If relative URL, prepend domain
      let urlStr = rawUrl;
      if (urlStr.startsWith('/')) {
        urlStr = 'https://www.facebook.com' + urlStr;
      }

      const urlObj = new URL(urlStr, 'https://www.facebook.com');
      
      // Tracking parameters to discard
      const trackers = [
        '__cft__', '__cft__[0]', '__tn__', 'fbclid', 'ref', 'ref_component', 
        'ref_page', 'acontext', 'sfnsn', 'mibextid', 'idorvanity', 'notif_t', 
        'notif_id', '__epa__', '__xts__', 'comment_id', 'reply_comment_id',
        'set', 'type', 'source', 'fs'
      ];
      
      trackers.forEach(param => {
        urlObj.searchParams.delete(param);
        // Also remove array-like variants
        for (const key of Array.from(urlObj.searchParams.keys())) {
          if (key.startsWith(param)) {
            urlObj.searchParams.delete(key);
          }
        }
      });

      // 1. Format Reel URL cleanly: https://www.facebook.com/reel/{id}/
      const reelMatch = urlObj.pathname.match(/\/reel\/([0-9a-zA-Z_-]+)/);
      if (reelMatch) {
        return `https://www.facebook.com/reel/${reelMatch[1]}/`;
      }

      // 2. Format Post URL cleanly: /{page}/posts/{id}/
      const postMatch = urlObj.pathname.match(/\/posts\/([0-9a-zA-Z_-]+)/);
      if (postMatch) {
        const pagePrefix = urlObj.pathname.split('/posts/')[0];
        return `${urlObj.origin}${pagePrefix}/posts/${postMatch[1]}/`;
      }

      // 3. Format Video URL cleanly: /{page}/videos/{id}/ or /watch/?v={id}
      const videoMatch = urlObj.pathname.match(/\/videos\/([0-9]+)/);
      if (videoMatch) {
        const pagePrefix = urlObj.pathname.split('/videos/')[0];
        return `${urlObj.origin}${pagePrefix}/videos/${videoMatch[1]}/`;
      }
      if (urlObj.pathname.includes('/watch') && urlObj.searchParams.has('v')) {
        return `https://www.facebook.com/watch/?v=${urlObj.searchParams.get('v')}`;
      }

      // 4. Permalink with story_fbid (keep story_fbid & id)
      if (urlObj.pathname.includes('permalink.php')) {
        const storyFbid = urlObj.searchParams.get('story_fbid');
        const id = urlObj.searchParams.get('id');
        let clean = `${urlObj.origin}/permalink.php?`;
        const params = [];
        if (storyFbid) params.push(`story_fbid=${encodeURIComponent(storyFbid)}`);
        if (id) params.push(`id=${encodeURIComponent(id)}`);
        return clean + params.join('&');
      }

      // 5. Photo URL
      if (urlObj.pathname.includes('/photo')) {
        const fbid = urlObj.searchParams.get('fbid');
        if (fbid) {
          return `${urlObj.origin}/photo.php?fbid=${encodeURIComponent(fbid)}`;
        }
      }

      // Fallback: clean search params
      let clean = urlObj.origin + urlObj.pathname;
      const search = urlObj.searchParams.toString();
      if (search) clean += '?' + search;
      return clean;
    } catch (e) {
      return rawUrl;
    }
  },

  /**
   * Extracts unique identifier (post ID or reel ID) from a URL or element
   */
  extractId(url) {
    if (!url) return 'fb_' + Math.random().toString(36).substr(2, 9);
    
    // Reel ID
    const reelMatch = url.match(/\/reel\/([0-9a-zA-Z_-]+)/);
    if (reelMatch) return 'reel_' + reelMatch[1];

    // Post ID (including modern alphanumeric pfbid0...)
    const postMatch = url.match(/\/posts\/([0-9a-zA-Z_-]+)/);
    if (postMatch) return 'post_' + postMatch[1];

    // story_fbid
    const storyMatch = url.match(/story_fbid=([0-9a-zA-Z_-]+)/);
    if (storyMatch) return 'post_' + storyMatch[1];

    // Video ID
    const videoMatch = url.match(/\/videos\/([0-9]+)/) || url.match(/[?&]v=([0-9]+)/);
    if (videoMatch) return 'video_' + videoMatch[1];

    // Photo fbid
    const photoMatch = url.match(/fbid=([0-9]+)/);
    if (photoMatch) return 'photo_' + photoMatch[1];

    // Fallback hash
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      hash = ((hash << 5) - hash) + url.charCodeAt(i);
      hash |= 0;
    }
    return 'fb_' + Math.abs(hash);
  },

  /**
   * Normalizes caption and text, keeping emojis, Bangla, English, and line breaks
   * Automatically strips button artifacts like "See more", "Show more", "Show less", etc.
   */
  cleanText(text) {
    if (!text) return '';
    let cleaned = text
      .replace(/\r\n/g, '\n')
      .replace(/\u00a0/g, ' ') // replace non-breaking space
      .replace(/\s+/g, ' ')
      .trim();

    // Repeatedly strip trailing button phrases (only specific phrases, not bare words)
    const buttonTrailingRegex = /(?:\s*\.{2,3}\s*|\s+)(?:see\s*more|show\s*more|show\s*less|see\s*less|আরও\s*দেখুন|কম\s*দেখুন)\s*$/gi;
    let prev = '';
    while (cleaned !== prev) {
      prev = cleaned;
      cleaned = cleaned.replace(buttonTrailingRegex, '').trim();
    }
    cleaned = cleaned.replace(/\n\s*(?:see\s*more|show\s*more|show\s*less|see\s*less|আরও\s*দেখুন|কম\s*দেখুন)\s*$/gi, '').trim();
    cleaned = cleaned.replace(/(?:see\s*more|show\s*more|show\s*less|see\s*less|আরও\s*দেখুন|কম\s*দেখুন)\s*$/gi, '').trim();
    cleaned = cleaned.replace(/\s*\.{2,3}\s*$/, '').trim();

    return cleaned;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Parser;
}
