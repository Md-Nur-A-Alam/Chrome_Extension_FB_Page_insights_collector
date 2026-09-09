/**
 * Centralized Facebook Selector Registry
 * STRICT ISOLATION: All Facebook DOM selectors are defined here.
 * If Facebook updates its layout, modify this file without touching parsers, database, or analytics.
 */

export const SELECTORS = {
  // Page Profile & Header
  page: {
    title: [
      'h1',
      'div[role="main"] h1',
      'div[data-pagelet="ProfileTiles"] h1'
    ],
    verifiedBadge: [
      '[aria-label*="Verified" i]',
      '[aria-label*="ভেরিফাইড" i]',
      'svg[aria-label*="Verified" i]'
    ],
    avatar: [
      'svg[aria-label] image',
      'div[role="main"] img[src*="scontent"]',
      'img[alt*="profile" i]',
      'img[alt*="avatar" i]'
    ]
  },

  // Timeline Posts
  post: {
    cards: [
      'div[role="feed"] > div',
      'div[role="article"]',
      'div[data-ad-preview="message"]'
    ],
    toolbar: [
      '[role="toolbar"]',
      '[aria-label*="Like" i]',
      '[aria-label*="লাইক" i]'
    ],
    caption: [
      'div[data-ad-preview="message"]',
      'div[dir="auto"]'
    ],
    expandCaptionButton: [
      'div[role="button"]',
      'span[role="button"]'
    ],
    reactions: [
      '[aria-label*="reaction" i]',
      '[aria-label*="reactions" i]',
      '[aria-label*="like" i]',
      '[aria-label*="লাইক" i]'
    ],
    comments: [
      '[aria-label*="comment" i]',
      '[aria-label*="comments" i]',
      '[aria-label*="মন্তব্য" i]'
    ],
    shares: [
      '[aria-label*="share" i]',
      '[aria-label*="shares" i]',
      '[aria-label*="শেয়ার" i]'
    ],
    views: [
      '[aria-label*="view" i]',
      '[aria-label*="views" i]'
    ],
    timestamp: [
      'abbr',
      'a[role="link"][href*="/posts/"]',
      'a[role="link"][href*="story_fbid="]',
      'a[role="link"][href*="permalink.php"]'
    ]
  },

  // Reels (Grid & Player Modal)
  reel: {
    gridLinks: [
      'a[href*="/reel/"]'
    ],
    gridCard: [
      'div[role="article"]',
      'div[tabindex="0"]'
    ],
    playerDialog: [
      'div[role="dialog"]',
      'div[data-pagelet*="Reel"]',
      'div[role="main"]'
    ],
    actionBar: [
      'div[role="dialog"] div[role="toolbar"]',
      'div[data-pagelet*="Reel"] div[role="toolbar"]',
      'div[role="main"] div'
    ],
    actionButtons: [
      'div[role="button"][aria-label]',
      'span[role="button"][aria-label]',
      'div[role="button"]'
    ],
    caption: [
      'div[dir="auto"]',
      'span[dir="auto"]'
    ],
    timestamp: [
      'a[role="link"][href*="/reel/"]',
      'abbr'
    ],
    videoElement: [
      'video'
    ],
    seekbar: [
      'div[role="progressbar"]',
      'div[aria-valuemax]'
    ]
  }
} as const;
