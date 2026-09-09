import { parseSocialNumber } from '../../shared/utils/number-normalizer';

export class CommentParser {
  /**
   * Extracts comments count from a container or action button
   */
  static parse(container: Element): number | null {
    const candidates = container.querySelectorAll(
      '[aria-label*="comment" i], [aria-label*="comments" i], [aria-label*="মন্তব্য" i]'
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

    // Check for comment header text (e.g. "45 comments")
    if (maxCount === null) {
      const headers = container.querySelectorAll('h2, h3, span[dir="auto"]');
      for (const h of Array.from(headers)) {
        const txt = (h.textContent || '').trim();
        if (/(?:comments|মন্তব্য|টি মন্তব্য)\b/i.test(txt) && txt.length < 30) {
          const val = parseSocialNumber(txt);
          if (val !== null) {
            maxCount = val;
            break;
          }
        }
      }
    }

    return maxCount;
  }
}
