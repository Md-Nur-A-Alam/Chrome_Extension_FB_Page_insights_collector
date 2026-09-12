/**
 * Caption Extractor
 * Strictly isolates caption body and discards any text from comment sections or navigation buttons.
 */
export class CaptionParser {
  /**
   * Expands collapsed "...See more" / "...আরও দেখুন" buttons
   */
  static expandCollapsedText(container: Element, toolbar?: Element | null): void {
    const buttons = container.querySelectorAll('div[role="button"], span[role="button"], a[role="button"], [role="button"]');
    buttons.forEach((btn) => {
      // Must not be inside comments, chat docks, or below toolbar
      if (
        (toolbar && toolbar.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING) ||
        btn.closest('[role="article"]') ||
        btn.closest('form') ||
        btn.closest('[role="complementary"]') ||
        btn.closest('[role="region"]') ||
        btn.closest('[aria-label*="Chat" i]')
      ) {
        return;
      }
      const txt = (btn.textContent || '').trim().toLowerCase();
      if (
        txt === 'see more' ||
        txt === '...see more' ||
        txt === '…see more' ||
        txt === 'show more' ||
        txt === '...show more' ||
        txt === '…show more' ||
        txt === 'more' ||
        txt === '...more' ||
        txt === '…more' ||
        txt === 'আরও দেখুন' ||
        txt === '...আরও' ||
        txt === '…আরও' ||
        txt.includes('see more') ||
        txt.includes('show more') ||
        txt.includes('আরও দেখুন')
      ) {
        try {
          (btn as HTMLElement).click();
        } catch {
          // Ignore click error
        }
      }
    });
  }

  /**
   * Extracts clean caption from a container element
   */
  static extractCaption(container: Element, toolbar?: Element | null, authorName?: string | null): string | null {
    this.expandCollapsedText(container, toolbar);

    // 1. Primary: data-ad-preview="message" (guaranteed post body)
    const previewMsg = container.querySelector<HTMLElement>('div[data-ad-preview="message"]');
    if (previewMsg && previewMsg.innerText.trim().length > 0) {
      return this.cleanText(previewMsg.innerText);
    }

    // 2. Identify and blacklist all comment elements, chat docks, complementaries, and navigation
    const commentRoots = container.querySelectorAll(
      '[aria-label*="Comment" i], [aria-label*="মন্তব্য" i], div[role="article"], form, ul, ' +
      '[role="region"], [role="complementary"], [role="navigation"], [role="banner"], ' +
      '[aria-label*="Chat" i], [aria-label*="Messenger" i], [aria-label*="Message" i], ' +
      'div[data-pagelet*="ChatTab"], div[data-pagelet*="Messenger"]'
    );
    const blacklisted = new Set<Element>();
    commentRoots.forEach((root) => {
      blacklisted.add(root);
      root.querySelectorAll('*').forEach((child) => blacklisted.add(child));
    });

    // 3. Search overlay info card starting from author link if present
    if (authorName) {
      const authorLinks = container.querySelectorAll<HTMLAnchorElement>('a[role="link"]');
      let authorEl: Element | null = null;
      for (const a of Array.from(authorLinks)) {
        if (blacklisted.has(a)) continue;
        if ((a.textContent || '').trim().toLowerCase() === authorName.toLowerCase()) {
          authorEl = a;
          break;
        }
      }

      if (authorEl) {
        let card: Element | null = authorEl.parentElement;
        for (let i = 0; i < 4 && card && card !== container; i++) {
          const cardNodes = card.querySelectorAll<HTMLElement>('div[dir="auto"], span[dir="auto"]');
          for (const node of Array.from(cardNodes)) {
            if (blacklisted.has(node)) continue;
            if (node.closest('[role="button"]') || node.closest('[role="toolbar"]') || node.closest('a[role="link"]')) continue;
            if (node.closest('[aria-label*="audio" i], [aria-label*="music" i]')) continue;

            const text = (node.innerText || node.textContent || '').trim();
            if (!text || text.length < 3) continue;
            if (text.toLowerCase() === authorName.toLowerCase()) continue;
            if (/^(like|comment|share|follow|views|view|ফলো|লাইক|মন্তব্য|শেয়ার|original audio|audio|sound)$/i.test(text)) continue;
            if (/(original audio|original sound|অরিজিনাল অডিও)/i.test(text) && text.length < 40) continue;
            if (/^[০-৯0-9.,KMBkmbহাজারলাখকোটি]+$/.test(text)) continue;
            if (/(assalamu\s*alaikum|thanks for your interest)/i.test(text) && text.includes('Tanvir')) continue;

            const cleaned = this.cleanText(text);
            if (cleaned.length > 0) return cleaned;
          }
          card = card.parentElement;
        }
      }
    }

    // 4. Examine candidate text elements
    const candidateNodes = container.querySelectorAll<HTMLElement>('div[dir="auto"], span[dir="auto"]');
    let bestText = '';

    for (const node of Array.from(candidateNodes)) {
      if (blacklisted.has(node)) continue;

      if (toolbar && toolbar.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) {
        continue;
      }

      if (
        node.closest('h1, h2, h3, h4, strong') ||
        node.closest('[role="button"]') ||
        node.closest('[role="toolbar"]') ||
        node.closest('[role="complementary"]') ||
        node.closest('[role="region"]') ||
        node.closest('[aria-label*="Chat" i]') ||
        node.closest('[aria-label*="Messenger" i]') ||
        node.closest('[aria-label*="audio" i], [aria-label*="music" i]')
      ) {
        continue;
      }

      const text = (node.innerText || node.textContent || '').trim();
      if (!text || text.length < 3) continue;
      if (authorName && text.toLowerCase() === authorName.toLowerCase()) continue;

      if (/^(like|comment|share|follow|views|view|ফলো|লাইক|মন্তব্য|শেয়ার|original audio|audio|sound|অরিজিনাল অডিও)$/i.test(text)) {
        continue;
      }
      if (/(original audio|original sound|অরিজিনাল অডিও)/i.test(text) && text.length < 40) continue;
      if (/^[০-৯0-9.,KMBkmbহাজারলাখকোটি]+$/.test(text)) continue;
      if (/(assalamu\s*alaikum|thanks for your interest)/i.test(text) && text.includes('Tanvir')) continue;

      if (text.length > bestText.length) {
        bestText = text;
      }
    }

    if (bestText) {
      return this.cleanText(bestText);
    }

    return null;
  }

  /**
   * Cleans text, preserving line breaks, emojis, and Bengali, and strips button artifacts
   * Handles unicode horizontal ellipsis (\u2026), multiple dots, line breaks, and spaces.
   */
  static cleanText(text: string): string {
    if (!text) return '';
    let cleaned = text
      .replace(/\r\n/g, '\n')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .trim();

    // Multi-pass removal of trailing button phrases
    const buttonTrailingRegex = /(?:[\s\.\u2026\u00a0]*)(?:see\s*more|show\s*more|show\s*less|see\s*less|more|less|আরও\s*দেখুন|কম\s*দেখুন)[\s\.\u2026\u00a0]*$/gi;
    let prev = '';
    while (cleaned !== prev) {
      prev = cleaned;
      cleaned = cleaned.replace(buttonTrailingRegex, '').trim();
    }
    cleaned = cleaned.replace(/\n\s*(?:see\s*more|show\s*more|show\s*less|see\s*less|more|less|আরও\s*দেখুন|কম\s*দেখুন)\s*$/gi, '').trim();
    cleaned = cleaned.replace(/[\s\.\u2026\u00a0]+$/, '').trim();

    return cleaned;
  }
}
