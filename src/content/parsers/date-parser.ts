import { formatTimeAgo, parseDateToIso, calculateAgeHours } from '../../shared/utils/date-normalizer';

export interface ParsedDateResult {
  publishedAt: string | null;
  publishedRelative: string | null;
  ageHours: number | null;
}

export class DateParser {
  /**
   * Extracts published date from header anchors or metadata
   */
  static parse(container: Element): ParsedDateResult {
    // 1. Meta tag check
    const meta = document.querySelector('meta[property="article:published_time"]');
    if (meta && meta.getAttribute('content')) {
      const content = meta.getAttribute('content')!;
      const iso = parseDateToIso(content);
      return {
        publishedAt: iso,
        publishedRelative: formatTimeAgo(content),
        ageHours: calculateAgeHours(iso)
      };
    }

    // 2. Abbr tag (often contains full title timestamp)
    const abbr = container.querySelector('abbr');
    if (abbr) {
      const title = abbr.getAttribute('title') || '';
      const text = abbr.textContent?.trim() || '';
      const iso = parseDateToIso(title) || parseDateToIso(text);
      return {
        publishedAt: iso,
        publishedRelative: formatTimeAgo(text || title),
        ageHours: calculateAgeHours(iso)
      };
    }

    // 3. Header timestamp anchors
    const anchors = container.querySelectorAll<HTMLAnchorElement>('a[role="link"]');
    for (const a of Array.from(anchors)) {
      if (a.closest('[role="article"]') || a.closest('form')) continue;

      const aria = a.getAttribute('aria-label') || '';
      const text = a.textContent?.trim() || '';

      if (aria && aria.length < 35 && !/(like|comment|share|follow|ফলো|লাইক|মন্তব্য)/i.test(aria)) {
        const iso = parseDateToIso(aria);
        return {
          publishedAt: iso,
          publishedRelative: formatTimeAgo(aria),
          ageHours: calculateAgeHours(iso)
        };
      }

      if (text && text.length < 25 && !/(like|comment|share|follow|ফলো|লাইক|মন্তব্য)/i.test(text)) {
        const iso = parseDateToIso(text);
        return {
          publishedAt: iso,
          publishedRelative: formatTimeAgo(text),
          ageHours: calculateAgeHours(iso)
        };
      }
    }

    return {
      publishedAt: null,
      publishedRelative: 'Recent',
      ageHours: null
    };
  }
}
