/**
 * Caption Extractor
 * Strictly isolates caption body and discards any text from comment sections or navigation buttons.
 */
export class CaptionParser {
  /**
   * Expands collapsed "...See more" / "...আরও দেখুন" buttons
   */
  static expandCollapsedText(container: Element, toolbar?: Element | null): void {
    const buttons = container.querySelectorAll('div[role="button"], span[role="button"]');
    buttons.forEach((btn) => {
      // Must not be inside comments below toolbar
      if (toolbar && toolbar.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING) {
        return;
      }
      const txt = (btn.textContent || '').trim().toLowerCase();
      if (
        txt === 'see more' ||
        txt === '...see more' ||
        txt === 'more' ||
        txt === '...more' ||
        txt === 'আরও দেখুন' ||
        txt === '...আরও'
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
  static extractCaption(container: Element, toolbar?: Element | null): string | null {
    this.expandCollapsedText(container, toolbar);

    // 1. Primary: data-ad-preview="message" (guaranteed post body)
    const previewMsg = container.querySelector<HTMLElement>('div[data-ad-preview="message"]');
    if (previewMsg && previewMsg.innerText.trim().length > 0) {
      return this.cleanText(previewMsg.innerText);
    }

    // 2. Identify and blacklist all comment elements
    const commentRoots = container.querySelectorAll(
      '[aria-label*="Comment" i], [aria-label*="মন্তব্য" i], div[role="article"], form'
    );
    const blacklisted = new Set<Element>();
    commentRoots.forEach((root) => {
      blacklisted.add(root);
      root.querySelectorAll('*').forEach((child) => blacklisted.add(child));
    });

    // 3. Examine candidate text elements
    const candidateNodes = container.querySelectorAll<HTMLElement>('div[dir="auto"], span[dir="auto"]');
    let bestText = '';

    for (const node of Array.from(candidateNodes)) {
      if (blacklisted.has(node)) continue;

      if (toolbar && toolbar.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) {
        continue;
      }

      if (node.closest('h1, h2, h3, h4, strong') || node.closest('[role="button"]') || node.closest('[role="toolbar"]')) {
        continue;
      }

      const text = (node.innerText || node.textContent || '').trim();
      if (!text || text.length < 3) continue;

      if (/^(like|comment|share|follow|views|view|ফলো|লাইক|মন্তব্য|শেয়ার|original audio|audio)$/i.test(text)) {
        continue;
      }

      if (text.length > bestText.length) {
        bestText = text;
      }
    }

    if (bestText) {
      let cleaned = bestText;
      for (let i = 0; i < 3; i++) {
        cleaned = cleaned.replace(/\s*(?:\.{2,3}\s*)?(?:see\s*more|show\s*more|show\s*less|see\s*less|আরও\s*দেখুন|কম\s*দেখুন)\s*$/gi, '').trim();
      }
      cleaned = cleaned.replace(/\s*\.{2,3}\s*$/, '').trim();
      return this.cleanText(cleaned);
    }

    return null;
  }

  /**
   * Cleans text, preserving line breaks, emojis, and Bengali, and strips button artifacts
   */
  static cleanText(text: string): string {
    if (!text) return '';
    let cleaned = text
      .replace(/\r\n/g, '\n')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .trim();

    // Multi-pass removal of trailing button phrases (only specific phrases)
    const buttonTrailingRegex = /(?:\s*\.{2,3}\s*|\s+)(?:see\s*more|show\s*more|show\s*less|see\s*less|আরও\s*দেখুন|কম\s*দেখুন)\s*$/gi;
    let prev = '';
    while (cleaned !== prev) {
      prev = cleaned;
      cleaned = cleaned.replace(buttonTrailingRegex, '').trim();
    }
    cleaned = cleaned.replace(/\n\s*(?:see\s*more|show\s*more|show\s*less|see\s*less|আরও\s*দেখুন|কম\s*দেখুন)\s*$/gi, '').trim();
    cleaned = cleaned.replace(/(?:see\s*more|show\s*more|show\s*less|see\s*less|আরও\s*দেখুন|কম\s*দেখুন)\s*$/gi, '').trim();
    cleaned = cleaned.replace(/\s*\.{2,3}\s*$/, '').trim();

    return cleaned;
  }
}
