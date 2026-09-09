import { PageProfile } from '../shared/types';

export class PageDetector {
  /**
   * Detect page profile and current context mode
   */
  public static detect(): { page: PageProfile | null; mode: 'posts' | 'reels' | 'unsupported' } {
    const url = window.location.href;
    const pathname = window.location.pathname;

    // Check if on Facebook
    if (!url.includes('facebook.com')) {
      return { page: null, mode: 'unsupported' };
    }

    const isReels = pathname.includes('/reels') || pathname.includes('/reel/');
    const mode = isReels ? 'reels' : 'posts';

    // Page Name extraction with fallbacks
    let pageName = '';
    const h1 = document.querySelector('h1');
    if (h1 && h1.textContent?.trim() && !h1.textContent.includes('Facebook')) {
      pageName = h1.textContent.trim();
    }

    if (!pageName) {
      const title = document.title;
      if (title && !title.startsWith('Facebook')) {
        pageName = title.split('|')[0]?.split('•')[0]?.trim() || '';
      }
    }

    if (!pageName) {
      pageName = 'Facebook Page';
    }

    // Handle / ID extraction from URL
    const pathParts = pathname.split('/').filter(Boolean);
    let pageId = pathParts[0] || 'page';
    if (pageId === 'watch' || pageId === 'reel' || pageId === 'groups') {
      pageId = pathParts[1] || pageId;
    }

    // Verified badge detection (multilingual: English & Bengali)
    const verified = !!document.querySelector(
      '[aria-label*="Verified"], [aria-label*="ভেরিফাইড"], svg[aria-label*="Verified"], svg[aria-label*="ভেরিফাইড"]'
    );

    // Profile Avatar
    let avatarUrl: string | undefined;
    const avatarImg = document.querySelector<HTMLImageElement>(
      'svg image, [role="main"] img[width="168"], [role="main"] img[width="132"], img[role="img"]'
    );
    if (avatarImg && avatarImg.src && !avatarImg.src.startsWith('data:image/svg')) {
      avatarUrl = avatarImg.src;
    }

    const page: PageProfile = {
      id: pageId,
      name: pageName,
      url,
      avatarUrl,
      verified,
      firstScrapedAt: new Date().toISOString(),
      lastScrapedAt: new Date().toISOString(),
      totalPostsCollected: 0,
      totalReelsCollected: 0
    };

    return { page, mode };
  }
}
