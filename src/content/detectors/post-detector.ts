import { SELECTORS } from '../selectors/facebook-selectors';
import { SelectorRegistry } from '../selectors/selector-registry';
import { cleanFacebookUrl, extractFacebookId } from '../../shared/utils/url-normalizer';

export interface DetectionResult {
  isMatch: boolean;
  confidence: number;
  id: string | null;
  url: string | null;
}

export class PostDetector {
  /**
   * Evaluates if a given DOM element is a Facebook Post container
   */
  static detect(element: Element): DetectionResult {
    let score = 0;
    let postUrl: string | null = null;
    let postId: string | null = null;

    // 1. Role or attribute matches
    if (element.getAttribute('role') === 'article' || element.getAttribute('data-ad-preview') === 'message') {
      score += 0.3;
    }

    // 2. Action toolbar presence
    const toolbar = SelectorRegistry.queryFirst(element, SELECTORS.post.toolbar);
    if (toolbar) {
      score += 0.3;
    }

    // 3. Search for permalink anchors
    const links = element.querySelectorAll<HTMLAnchorElement>('a[href]');
    for (const link of Array.from(links)) {
      const href = link.getAttribute('href') || '';
      if (
        href.includes('/posts/') ||
        href.includes('story_fbid=') ||
        href.includes('permalink.php')
      ) {
        const clean = cleanFacebookUrl(href);
        const id = extractFacebookId(clean || href);
        if (id) {
          postId = id.replace(/^post_/, '');
          postUrl = clean;
          score += 0.4;
          break;
        }
      }
    }

    const confidence = Math.min(1.0, score);
    return {
      isMatch: confidence >= 0.6,
      confidence,
      id: postId,
      url: postUrl
    };
  }
}
