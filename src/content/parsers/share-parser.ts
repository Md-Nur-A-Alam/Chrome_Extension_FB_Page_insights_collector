import { parseSocialNumber } from '../../shared/utils/number-normalizer';

export class ShareParser {
  /**
   * Extracts share count from a container or action button
   */
  static parse(container: Element): number | null {
    const candidates = container.querySelectorAll(
      '[aria-label*="share" i], [aria-label*="shares" i], [aria-label*="শেয়ার" i], [aria-label*="send this to friends" i]'
    );

    let maxCount: number | null = null;

    candidates.forEach((el) => {
      const aria = el.getAttribute('aria-label') || '';
      let num = parseSocialNumber(aria);

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
