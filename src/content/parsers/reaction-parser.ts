import { parseSocialNumber } from '../../shared/utils/number-normalizer';

export class ReactionParser {
  /**
   * Extracts reaction count from a container or action button
   */
  static parse(container: Element): number | null {
    const candidates = container.querySelectorAll(
      '[aria-label*="reaction" i], [aria-label*="like" i], [aria-label*="লাইক" i], [aria-label*="প্রতিক্রিয়া" i]'
    );

    let maxCount: number | null = null;

    candidates.forEach((el) => {
      // Must not be in comments or chat docks
      if (
        el.closest('[role="article"]') ||
        el.closest('form') ||
        el.closest('[role="complementary"]') ||
        el.closest('[role="region"]') ||
        el.closest('[aria-label*="Chat" i]')
      ) {
        return;
      }

      const aria = el.getAttribute('aria-label') || '';
      let num = parseSocialNumber(aria);

      // Inspect text content of element or parent wrapper
      if (num === null) {
        num = parseSocialNumber(el.textContent);
      }
      if (num === null && el.parentElement) {
        const span = el.parentElement.querySelector('span[dir="auto"]');
        if (span) {
          num = parseSocialNumber(span.textContent);
        }
      }

      if (num !== null) {
        if (maxCount === null || num > maxCount) {
          maxCount = num;
        }
      }
    });

    return maxCount;
  }
}
