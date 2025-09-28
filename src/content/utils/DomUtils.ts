/**
 * DOM utility functions for async element waiting and content loading detection
 */

import { DetectorConfig } from '../types/GameInfo';

export class DomUtils {
  private static readonly DEFAULT_TIMEOUT = 5000;
  private static readonly DEFAULT_INTERVAL = 100;

  /**
   * Wait for an element to appear in the DOM
   */
  static async waitForElement(
    selector: string,
    timeout: number = DomUtils.DEFAULT_TIMEOUT,
    parent: Element | Document = document
  ): Promise<Element | null> {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkElement = () => {
        const element = parent.querySelector(selector);

        if (element) {
          resolve(element);
          return;
        }

        if (Date.now() - startTime >= timeout) {
          resolve(null);
          return;
        }

        setTimeout(checkElement, DomUtils.DEFAULT_INTERVAL);
      };

      checkElement();
    });
  }

  /**
   * Wait for multiple elements to appear in the DOM
   */
  static async waitForElements(
    selectors: string[],
    timeout: number = DomUtils.DEFAULT_TIMEOUT,
    requireAll: boolean = false
  ): Promise<Map<string, Element | null>> {
    const results = new Map<string, Element | null>();
    const promises = selectors.map(async (selector) => {
      const element = await DomUtils.waitForElement(selector, timeout);
      results.set(selector, element);
      return { selector, element };
    });

    const resolved = await Promise.all(promises);

    if (requireAll && resolved.some(({ element }) => !element)) {
      // If requiring all elements and some are missing, return empty results
      selectors.forEach(selector => results.set(selector, null));
    }

    return results;
  }

  /**
   * Wait for page content to stabilize (useful for SPA navigation)
   */
  static async waitForContentStability(
    config: Partial<DetectorConfig> = {}
  ): Promise<boolean> {
    const maxWaitTime = config.maxWaitTime || 3000;
    const checkInterval = config.checkInterval || 200;
    const startTime = Date.now();

    let lastContentHash = '';
    let stableCount = 0;
    const requiredStableChecks = 3;

    return new Promise((resolve) => {
      const checkStability = () => {
        const currentTime = Date.now();

        if (currentTime - startTime >= maxWaitTime) {
          resolve(false);
          return;
        }

        // Create a hash of key page elements
        const contentHash = DomUtils.getPageContentHash();

        if (contentHash === lastContentHash) {
          stableCount++;
          if (stableCount >= requiredStableChecks) {
            resolve(true);
            return;
          }
        } else {
          stableCount = 0;
          lastContentHash = contentHash;
        }

        setTimeout(checkStability, checkInterval);
      };

      checkStability();
    });
  }

  /**
   * Create a hash of page content to detect changes
   */
  private static getPageContentHash(): string {
    const keySelectors = [
      'title',
      'meta[property="og:title"]',
      '.apphub_AppName',
      '.game_area_description',
      '#appHubAppName'
    ];

    const content = keySelectors
      .map(selector => {
        const element = document.querySelector(selector);
        return element?.textContent?.trim() || '';
      })
      .join('|');

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString();
  }

  /**
   * Check if the page is still loading content
   */
  static isPageLoading(): boolean {
    // Check for common loading indicators
    const loadingSelectors = [
      '.loading',
      '.spinner',
      '[data-loading="true"]',
      '.steam_loading'
    ];

    const hasLoadingIndicators = loadingSelectors.some(selector =>
      document.querySelector(selector) !== null
    );

    // Check document readiness
    const documentLoading = document.readyState !== 'complete';

    // Check for pending requests (if performance API is available)
    let pendingRequests = false;
    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
      const navigationEntries = performance.getEntriesByType('navigation');
      if (navigationEntries.length > 0) {
        const nav = navigationEntries[0] as PerformanceNavigationTiming;
        pendingRequests = nav.loadEventEnd === 0;
      }
    }

    return hasLoadingIndicators || documentLoading || pendingRequests;
  }

  /**
   * Safe text content extraction with fallbacks
   */
  static safeTextContent(element: Element | null): string {
    if (!element) return '';

    try {
      return element.textContent?.trim() || '';
    } catch (error) {
      console.warn('[DomUtils] Error extracting text content:', error);
      return '';
    }
  }

  /**
   * Safe attribute extraction
   */
  static safeAttribute(element: Element | null, attribute: string): string {
    if (!element) return '';

    try {
      return element.getAttribute(attribute) || '';
    } catch (error) {
      console.warn('[DomUtils] Error extracting attribute:', error);
      return '';
    }
  }

  /**
   * Check if an element is visible and has content
   */
  static isElementVisible(element: Element): boolean {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  /**
   * Find the best title element from multiple candidates
   */
  static findBestTitleElement(selectors: string[]): { element: Element | null; selector: string } {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && DomUtils.isElementVisible(element)) {
        const text = DomUtils.safeTextContent(element);
        if (text.length > 0) {
          return { element, selector };
        }
      }
    }

    return { element: null, selector: '' };
  }

  /**
   * Throttle function to limit rapid successive calls
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;

    return function(this: any, ...args: Parameters<T>) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Debounce function to delay execution until after calls have stopped
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;

    return function(this: any, ...args: Parameters<T>) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  /**
   * Create a performance-optimized element observer
   */
  static createOptimizedObserver(
    callback: MutationCallback,
    options: MutationObserverInit = {}
  ): MutationObserver {
    // Throttle the callback to prevent excessive execution
    const throttledCallback = DomUtils.throttle(callback, 16); // ~60fps

    // Return observer without options - they must be passed to observe() method
    return new MutationObserver(throttledCallback);
  }
}