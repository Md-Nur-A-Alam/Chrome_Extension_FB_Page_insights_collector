/**
 * Safe selector execution engine with fallback hierarchies
 */
export class SelectorRegistry {
  /**
   * Queries the first matching element from a prioritized candidate array
   */
  static queryFirst<T extends Element = Element>(
    parent: ParentNode,
    selectors: readonly string[]
  ): T | null {
    for (const selector of selectors) {
      try {
        const el = parent.querySelector<T>(selector);
        if (el) return el;
      } catch (err) {
        console.warn('[SelectorRegistry] Invalid selector candidate:', selector, err);
      }
    }
    return null;
  }

  /**
   * Queries all elements matching any selector candidate, deduplicating results
   */
  static queryAll<T extends Element = Element>(
    parent: ParentNode,
    selectors: readonly string[]
  ): T[] {
    const results = new Set<T>();
    for (const selector of selectors) {
      try {
        const elements = parent.querySelectorAll<T>(selector);
        elements.forEach((el) => results.add(el));
      } catch (err) {
        console.warn('[SelectorRegistry] Invalid selector candidate:', selector, err);
      }
    }
    return Array.from(results);
  }

  /**
   * Checks if an element matches any selector in the list
   */
  static matchesAny(element: Element, selectors: readonly string[]): boolean {
    for (const selector of selectors) {
      try {
        if (element.matches(selector)) return true;
      } catch {
        // Ignore invalid selectors
      }
    }
    return false;
  }
}
