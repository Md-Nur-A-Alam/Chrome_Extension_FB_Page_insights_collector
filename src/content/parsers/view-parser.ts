import { parseSocialNumber } from '../../shared/utils/number-normalizer';

export class ViewParser {
  /**
   * Extracts view count from grid badges or video views element
   */
  static parse(container: Element): number | null {
    const candidates = container.querySelectorAll('span, div');
    for (const el of Array.from(candidates)) {
      const txt = (el.textContent || '').trim();
      // Match pure compact numbers (e.g. 1.2K, 350K) on thumbnail badges
      if (/^[০-৯0-9]+(?:\.[০-৯0-9]+)?[KMBkmbহাজারলাখকোটি]?$/.test(txt) && txt.length < 15) {
        const val = parseSocialNumber(txt);
        if (val !== null && val > 0) return val;
      }
      // Match explicit text like "12.5K views" or "বার দেখা হয়েছে"
      if (/(?:views|view|ভিউ|বার দেখা হয়েছে)/i.test(txt) && txt.length < 30) {
        const val = parseSocialNumber(txt);
        if (val !== null && val > 0) return val;
      }
    }
    return null;
  }
}
