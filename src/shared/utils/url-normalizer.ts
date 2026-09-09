const TRACKING_PARAMS = [
  '__cft__', '__cft__[0]', '__tn__', 'fbclid', 'ref', 'ref_component',
  'ref_page', 'acontext', 'sfnsn', 'mibextid', 'idorvanity', 'notif_t',
  'notif_id', '__epa__', '__xts__', 'comment_id', 'reply_comment_id',
  'set', 'type', 'source', 'fs', 'substory_index'
];

/**
 * Strips Facebook tracking and analytics parameters, producing clean canonical permalinks.
 */
export function cleanFacebookUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;

  try {
    let urlStr = rawUrl.trim();
    if (urlStr.startsWith('/')) {
      urlStr = 'https://www.facebook.com' + urlStr;
    }

    const urlObj = new URL(urlStr, 'https://www.facebook.com');

    // Remove tracking query parameters
    TRACKING_PARAMS.forEach((param) => {
      urlObj.searchParams.delete(param);
      for (const key of Array.from(urlObj.searchParams.keys())) {
        if (key.startsWith(param)) {
          urlObj.searchParams.delete(key);
        }
      }
    });

    // 1. Reel permalink: https://www.facebook.com/reel/{id}/
    const reelMatch = urlObj.pathname.match(/\/reel\/([0-9a-zA-Z_-]+)/);
    if (reelMatch && reelMatch[1]) {
      return `https://www.facebook.com/reel/${reelMatch[1]}/`;
    }

    // 2. Post permalink: /{page}/posts/{id}/
    const postMatch = urlObj.pathname.match(/\/posts\/([0-9a-zA-Z_-]+)/);
    if (postMatch && postMatch[1]) {
      const pagePrefix = urlObj.pathname.split('/posts/')[0];
      return `${urlObj.origin}${pagePrefix}/posts/${postMatch[1]}/`;
    }

    // 3. Video permalink: /{page}/videos/{id}/ or /watch/?v={id}
    const videoMatch = urlObj.pathname.match(/\/videos\/([0-9]+)/);
    if (videoMatch && videoMatch[1]) {
      const pagePrefix = urlObj.pathname.split('/videos/')[0];
      return `${urlObj.origin}${pagePrefix}/videos/${videoMatch[1]}/`;
    }
    if (urlObj.pathname.includes('/watch') && urlObj.searchParams.has('v')) {
      return `https://www.facebook.com/watch/?v=${urlObj.searchParams.get('v')}`;
    }

    // Clean remaining search string
    let clean = urlObj.origin + urlObj.pathname;
    const search = urlObj.searchParams.toString();
    if (search) clean += '?' + search;
    return clean;
  } catch {
    return rawUrl;
  }
}

/**
 * Extracts unique post or reel identifier from URL or element text
 */
export function extractFacebookId(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;

  // 1. Reel ID
  const reelMatch = rawUrl.match(/\/reel\/([0-9a-zA-Z_-]+)/);
  if (reelMatch && reelMatch[1]) return `reel_${reelMatch[1]}`;

  // 2. Post ID (including modern alphanumeric pfbid0...)
  const postMatch = rawUrl.match(/\/posts\/([0-9a-zA-Z_-]+)/);
  if (postMatch && postMatch[1]) return `post_${postMatch[1]}`;

  // 3. story_fbid
  const storyMatch = rawUrl.match(/story_fbid=([0-9a-zA-Z_-]+)/);
  if (storyMatch && storyMatch[1]) return `post_${storyMatch[1]}`;

  // 4. Video ID
  const videoMatch = rawUrl.match(/\/videos\/([0-9]+)/) || rawUrl.match(/[?&]v=([0-9]+)/);
  if (videoMatch && videoMatch[1]) return `video_${videoMatch[1]}`;

  // 5. Photo fbid
  const photoMatch = rawUrl.match(/fbid=([0-9]+)/);
  if (photoMatch && photoMatch[1]) return `photo_${photoMatch[1]}`;

  return null;
}
