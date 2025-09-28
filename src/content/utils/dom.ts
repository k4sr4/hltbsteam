/**
 * DOM utilities for async element waiting and safe DOM access
 */

/**
 * Sanitizes a string to prevent XSS attacks
 */
export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input.replace(/[<>"'&]/g, (match) => {
    const entities: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '&': '&amp;'
    };
    return entities[match] || match;
  });
}

/**
 * Normalizes game title by removing common suffixes and cleaning whitespace
 */
export function normalizeTitle(title: string): string {
  if (!title) return '';

  return title
    // Remove common Steam suffixes
    .replace(/\s+on\s+Steam$/i, '')
    .replace(/\s+-\s+Steam$/i, '')

    // Remove trademark symbols
    .replace(/[™®©]/g, '')

    // Remove sale/promotional text
    .replace(/\s*-\s*\d+%\s*off/i, '')
    .replace(/\s*\(\s*sale\s*\)/i, '')
    .replace(/\s*\[\s*sale\s*\]/i, '')

    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Waits for an element to appear in the DOM
 */
export function waitForElement(
  selector: string,
  timeout: number = 5000,
  root: Document | Element = document
): Promise<Element | null> {
  return new Promise((resolve) => {
    // Check if element already exists
    const element = root.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    let timeoutId: number;
    let observer: MutationObserver | null = null;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (observer) {
        observer.disconnect();
      }
    };

    // Set up timeout
    timeoutId = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeout);

    // Set up mutation observer
    observer = new MutationObserver(() => {
      const element = root.querySelector(selector);
      if (element) {
        cleanup();
        resolve(element);
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true
    });
  });
}

/**
 * Waits for multiple elements to appear in the DOM
 */
export async function waitForElements(
  selectors: string[],
  timeout: number = 5000,
  root: Document | Element = document
): Promise<(Element | null)[]> {
  const promises = selectors.map(selector =>
    waitForElement(selector, timeout, root)
  );
  return Promise.all(promises);
}

/**
 * Waits for the DOM to be ready
 */
export function waitForDOMReady(timeout: number = 10000): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      resolve(true);
      return;
    }

    let timeoutId: number;

    const onReady = () => {
      clearTimeout(timeoutId);
      document.removeEventListener('DOMContentLoaded', onReady);
      resolve(true);
    };

    document.addEventListener('DOMContentLoaded', onReady);

    timeoutId = window.setTimeout(() => {
      document.removeEventListener('DOMContentLoaded', onReady);
      resolve(false);
    }, timeout);
  });
}

/**
 * Safely gets element text content
 */
export function getElementText(element: Element | null): string {
  if (!element) return '';
  return sanitizeString(element.textContent || '').trim();
}

/**
 * Safely gets element attribute
 */
export function getElementAttribute(element: Element | null, attribute: string): string {
  if (!element) return '';
  return sanitizeString(element.getAttribute(attribute) || '').trim();
}

/**
 * Gets multiple elements by selectors and returns the first found
 */
export function getFirstElementBySelectors(selectors: string[], root: Document | Element = document): Element | null {
  for (const selector of selectors) {
    try {
      const element = root.querySelector(selector);
      if (element) {
        return element;
      }
    } catch (error) {
      console.warn(`[HLTB] Invalid selector: ${selector}`, error);
    }
  }
  return null;
}

/**
 * Gets text content from multiple selectors, returns first non-empty
 */
export function getTextFromSelectors(selectors: string[], root: Document | Element = document): string {
  for (const selector of selectors) {
    try {
      const element = root.querySelector(selector);
      if (element) {
        const text = getElementText(element);
        if (text) {
          return text;
        }
      }
    } catch (error) {
      console.warn(`[HLTB] Invalid selector: ${selector}`, error);
    }
  }
  return '';
}

/**
 * Debounces a function call
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => func(...args), delay);
  };
}

/**
 * Throttles a function call
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  };
}

/**
 * Checks if an element is visible in the viewport
 */
export function isElementVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth
  );
}

/**
 * Gets computed style property safely
 */
export function getComputedStyleProperty(element: Element, property: string): string {
  try {
    const computedStyle = window.getComputedStyle(element);
    return computedStyle.getPropertyValue(property) || '';
  } catch (error) {
    console.warn(`[HLTB] Error getting computed style:`, error);
    return '';
  }
}

/**
 * Creates a safe DOM element with sanitized content
 */
export function createSafeElement(
  tagName: string,
  className?: string,
  textContent?: string
): HTMLElement {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (textContent) {
    element.textContent = sanitizeString(textContent);
  }

  return element;
}

/**
 * Removes all event listeners from an element
 */
export function removeAllEventListeners(element: Element): Element {
  const newElement = element.cloneNode(true) as Element;
  element.parentNode?.replaceChild(newElement, element);
  return newElement;
}

/**
 * Measures performance of a function
 */
export async function measurePerformance<T>(
  func: () => Promise<T> | T,
  label?: string
): Promise<{ result: T; duration: number; memoryUsed?: number }> {
  const startTime = performance.now();
  const startMemory = (performance as any).memory?.usedJSHeapSize;

  const result = await func();

  const endTime = performance.now();
  const endMemory = (performance as any).memory?.usedJSHeapSize;

  const duration = endTime - startTime;
  const memoryUsed = startMemory && endMemory ? endMemory - startMemory : undefined;

  if (label) {
    console.log(`[HLTB] ${label}: ${duration.toFixed(2)}ms${memoryUsed ? `, ${memoryUsed} bytes` : ''}`);
  }

  return { result, duration, memoryUsed: memoryUsed || 0 };
}