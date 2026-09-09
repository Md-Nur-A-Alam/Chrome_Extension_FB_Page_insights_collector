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
   * Formats video duration from seconds (e.g. 45 -> "0:45", 85 -> "1:25", 3665 -> "1:01:05")
   */
  formatDuration(seconds) {
    if (!seconds || isNaN(seconds) || seconds <= 0) return 'N/A';
    const totalSecs = Math.round(seconds);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
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
   */
  cleanText(text) {
    if (!text) return '';
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\u00a0/g, ' ') // replace non-breaking space
      .replace(/\s+/g, ' ')
      .trim();
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Parser;
}
