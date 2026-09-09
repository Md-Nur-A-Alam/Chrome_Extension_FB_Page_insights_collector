import { cleanFacebookUrl, extractFacebookId } from '../../shared/utils/url-normalizer';

export interface ReelDetectionResult {
  isMatch: boolean;
  confidence: number;
  id: string | null;
  url: string | null;
  isPlayerModal: boolean;
}

export class ReelDetector {
  /**
   * Evaluates if a given DOM element or the active window context is a Facebook Reel
   */
  static detect(element?: Element | null): ReelDetectionResult {
    let score = 0;
    let reelUrl: string | null = null;
    let reelId: string | null = null;
    let isPlayerModal = false;

    // Check active window URL first (e.g. standalone reel player or overlay)
    const currentUrl = window.location.href;
    if (currentUrl.includes('/reel/')) {
      reelUrl = cleanFacebookUrl(currentUrl);
      const id = extractFacebookId(reelUrl || currentUrl);
      if (id) {
        reelId = id.replace(/^reel_/, '');
        score += 0.8;
      }
      isPlayerModal = true;
    }

    // Inspect element if provided
    if (element) {
      const anchor = element.matches('a[href*="/reel/"]')
        ? (element as HTMLAnchorElement)
        : element.querySelector<HTMLAnchorElement>('a[href*="/reel/"]');

      if (anchor) {
        const href = anchor.getAttribute('href') || anchor.href || '';
        const clean = cleanFacebookUrl(href);
        const id = extractFacebookId(clean || href);
        if (id) {
          reelId = id.replace(/^reel_/, '');
          reelUrl = clean;
          score += 0.5;
        }
      }

      if (element.getAttribute('role') === 'dialog' && element.querySelector('video')) {
        isPlayerModal = true;
        score += 0.3;
      }
    }

    const confidence = Math.min(1.0, score);
    return {
      isMatch: confidence >= 0.5,
      confidence,
      id: reelId,
      url: reelUrl,
      isPlayerModal
    };
  }
}
