import { parseSocialNumber } from '../../shared/utils/number-normalizer';

export class ShareParser {
  /**
   * Extracts share count from a container or action button
   */
  static parse(container: Element): number | null {
    const candidates = container.querySelectorAll(
      '[aria-label*="share" i], [aria-label*="shares" i], [aria-label*="শেয়ার" i], [aria-label*="শেয়ার" i], [aria-label*="send this to friends" i], [aria-label*="send this" i]'
    );

    let maxCount: number | null = null;
    let foundValidButton = false;

    const evaluateText = (txt: string | null | undefined): number | null => {
      if (!txt) return null;
      const str = txt.trim();
      if (!str || str.length > 45) return null;
      if (/^[0-9]+:[0-9]+/.test(str)) return null;
      if (/(?:ago|ঘণ্টা|দিন|মিনিট|yesterday|just now)/i.test(str)) return null;
      if (/(?:play|pause|volume|mute|close|back|more options|next|previous|reply|seek|speed|settings)/i.test(str)) return null;
      if (/^(?:send this to friends|share to feed|share$|শেয়ার$|শেয়ার$)/i.test(str)) return null;
      return parseSocialNumber(str);
    };

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

      foundValidButton = true;
      const btn = el.closest('[role="button"]') || el;

      // 1. Aria-label / title directly on el or btn
      let num = evaluateText(btn.getAttribute('aria-label') || btn.getAttribute('title'));
      if (num === null && el !== btn) {
        num = evaluateText(el.getAttribute('aria-label') || el.getAttribute('title'));
      }

      // 2. Child icons
      if (num === null) {
        const childIcons = btn.querySelectorAll('svg, i, [aria-label], [title]');
        for (const icon of Array.from(childIcons)) {
          const val = evaluateText(icon.getAttribute('aria-label') || icon.getAttribute('title'));
          if (val !== null) {
            num = val;
            break;
          }
        }
      }

      // 3. Inner text / spans
      if (num === null) {
        const innerSpans = btn.querySelectorAll('span, div');
        for (const s of Array.from(innerSpans)) {
          const val = evaluateText(s.textContent);
          if (val !== null) {
            num = val;
            break;
          }
        }
      }

      // 4. Direct siblings
      if (num === null) {
        let sib = btn.nextElementSibling;
        while (sib) {
          if (sib.querySelector?.('[role="button"]') || sib.getAttribute?.('role') === 'button') break;
          const val = evaluateText(sib.textContent);
          if (val !== null) {
            num = val;
            break;
          }
          sib = sib.nextElementSibling;
        }
      }

      // 5. Ancestor hierarchy traversal (up to 5 levels)
      if (num === null) {
        let ancestor = btn.parentElement;
        for (let depth = 1; depth <= 5 && ancestor && ancestor !== document.body; depth++) {
          const role = ancestor.getAttribute('role');
          if (role === 'toolbar' || role === 'dialog' || role === 'main' || role === 'region') break;

          // Stop if ancestor contains another action button (like/comment)
          const otherButtons = ancestor.querySelectorAll('[role="button"]');
          let containsOther = false;
          for (const other of Array.from(otherButtons)) {
            if (other === btn || btn.contains(other) || other.contains(btn)) continue;
            const oAria = (other.getAttribute('aria-label') || '').toLowerCase();
            if (/(?:like|comment|react|love|লাইক|মন্তব্য)/i.test(oAria)) {
              containsOther = true;
              break;
            }
          }
          if (containsOther) break;

          // Check leaf nodes inside ancestor
          const candidateNodes = ancestor.querySelectorAll('span, div');
          for (const node of Array.from(candidateNodes)) {
            if (btn.contains(node)) continue;
            if (node.querySelector('span, div')) continue;
            const val = evaluateText(node.textContent || node.getAttribute('aria-label'));
            if (val !== null) {
              num = val;
              break;
            }
          }
          if (num !== null) break;

          // Check siblings of ancestor
          let aSib = ancestor.nextElementSibling;
          while (aSib) {
            if (aSib.querySelector?.('[role="button"]') || aSib.getAttribute?.('role') === 'button') break;
            const val = evaluateText(aSib.textContent);
            if (val !== null) {
              num = val;
              break;
            }
            aSib = aSib.nextElementSibling;
          }
          if (num !== null) break;

          ancestor = ancestor.parentElement;
        }
      }

      if (num !== null) {
        if (maxCount === null || num > maxCount) {
          maxCount = num;
        }
      }
    });

    // 6. Fallback text scan in container if still null
    if (maxCount === null) {
      const candidates = container.querySelectorAll('span, div, a');
      for (const el of Array.from(candidates)) {
        if (
          el.children.length > 0 ||
          el.closest('[role="article"]') ||
          el.closest('form') ||
          el.closest('[role="complementary"]') ||
          el.closest('[role="region"]') ||
          el.closest('[aria-label*="Chat" i]')
        ) {
          continue;
        }

        const txt = (el.textContent || '').trim();
        if (
          /(?:[0-9০-৯]+(?:\.[0-9০-৯]+)?[kmbহাজারলাখকোটি]?\s*(?:shares?|শেয়ার|টি শেয়ার)|(?:shares?|শেয়ার|টি শেয়ার)[:\s]+[0-9০-৯]+)/i.test(txt) &&
          txt.length < 35
        ) {
          const val = parseSocialNumber(txt);
          if (val !== null) {
            maxCount = val;
            break;
          }
        }
      }
    }

    if (maxCount !== null) return maxCount;
    if (foundValidButton) return 0;
    return null;
  }
}
