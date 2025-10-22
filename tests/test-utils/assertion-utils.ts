/**
 * Custom Jest Matchers and Assertion Utilities
 *
 * Extended assertions specific to HLTB extension testing
 */

import { DisplayState, ComponentMetrics } from '../../src/content/types/HLTB';

/**
 * Asserts that a value is within a range
 */
export function expectWithinRange(value: number, min: number, max: number): void {
  expect(value).toBeGreaterThanOrEqual(min);
  expect(value).toBeLessThanOrEqual(max);
}

/**
 * Asserts that time is below threshold
 */
export function expectTimingBelow(actualMs: number, thresholdMs: number): void {
  expect(actualMs).toBeLessThan(thresholdMs);
  if (actualMs >= thresholdMs) {
    throw new Error(
      `Timing exceeded threshold: ${actualMs}ms >= ${thresholdMs}ms`
    );
  }
}

/**
 * Asserts component metrics meet performance targets
 */
export function expectPerformanceMetrics(
  metrics: ComponentMetrics,
  targets: {
    creation?: number;
    injection?: number;
    render?: number;
    total?: number;
    domOps?: number;
  } = {}
): void {
  const defaults = {
    creation: 10,
    injection: 20,
    render: 20,
    total: 50,
    domOps: 30
  };

  const thresholds = { ...defaults, ...targets };

  if (metrics.creationTime > thresholds.creation) {
    throw new Error(
      `Creation time ${metrics.creationTime}ms exceeds target ${thresholds.creation}ms`
    );
  }

  if (metrics.injectionTime > thresholds.injection) {
    throw new Error(
      `Injection time ${metrics.injectionTime}ms exceeds target ${thresholds.injection}ms`
    );
  }

  if (metrics.renderTime > thresholds.render) {
    throw new Error(
      `Render time ${metrics.renderTime}ms exceeds target ${thresholds.render}ms`
    );
  }

  if (metrics.totalTime > thresholds.total) {
    throw new Error(
      `Total time ${metrics.totalTime}ms exceeds target ${thresholds.total}ms`
    );
  }

  if (metrics.domOperations > thresholds.domOps) {
    throw new Error(
      `DOM operations ${metrics.domOperations} exceeds target ${thresholds.domOps}`
    );
  }
}

/**
 * Asserts element has specific text content
 */
export function expectTextContent(element: Element | ShadowRoot, expectedText: string): void {
  const actualText = element.textContent || '';
  expect(actualText).toContain(expectedText);
}

/**
 * Asserts element does NOT have specific text content
 */
export function expectNoTextContent(element: Element | ShadowRoot, unexpectedText: string): void {
  const actualText = element.textContent || '';
  expect(actualText).not.toContain(unexpectedText);
}

/**
 * Asserts shadow DOM contains element with selector
 */
export function expectShadowElement(
  shadowRoot: ShadowRoot,
  selector: string
): HTMLElement {
  const element = shadowRoot.querySelector(selector);
  expect(element).not.toBeNull();
  return element as HTMLElement;
}

/**
 * Asserts shadow DOM does NOT contain element
 */
export function expectNoShadowElement(
  shadowRoot: ShadowRoot,
  selector: string
): void {
  const element = shadowRoot.querySelector(selector);
  expect(element).toBeNull();
}

/**
 * Asserts element has ARIA attributes
 */
export function expectAriaAttributes(
  element: Element,
  attributes: Record<string, string>
): void {
  Object.entries(attributes).forEach(([key, value]) => {
    const attrName = key.startsWith('aria-') ? key : `aria-${key}`;
    expect(element.getAttribute(attrName)).toBe(value);
  });
}

/**
 * Asserts element is accessible
 */
export function expectAccessible(element: Element): void {
  // Check for role
  const role = element.getAttribute('role');
  const ariaLabel = element.getAttribute('aria-label');
  const ariaLabelledBy = element.getAttribute('aria-labelledby');

  const hasAccessibleName = ariaLabel || ariaLabelledBy || element.textContent?.trim();

  expect(hasAccessibleName).toBeTruthy();
}

/**
 * Asserts display state matches expected
 */
export function expectDisplayState(actual: DisplayState, expected: DisplayState): void {
  expect(actual).toBe(expected);
  if (actual !== expected) {
    throw new Error(
      `Expected display state "${expected}", but got "${actual}"`
    );
  }
}

/**
 * Asserts no XSS vulnerabilities (no innerHTML with user data)
 */
export function expectNoXSS(element: Element | ShadowRoot): void {
  const html = (element as any).innerHTML || '';

  // Check for common XSS patterns
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /onerror=/i,
    /onclick=/i,
    /onload=/i
  ];

  xssPatterns.forEach(pattern => {
    expect(html).not.toMatch(pattern);
  });
}

/**
 * Asserts element has data attributes
 */
export function expectDataAttributes(
  element: Element,
  attributes: Record<string, string>
): void {
  Object.entries(attributes).forEach(([key, value]) => {
    const attrName = key.startsWith('data-') ? key : `data-${key}`;
    expect(element.getAttribute(attrName)).toBe(value);
  });
}

/**
 * Asserts CSS class is present
 */
export function expectClass(element: Element, className: string): void {
  expect(element.classList.contains(className)).toBe(true);
}

/**
 * Asserts CSS class is NOT present
 */
export function expectNoClass(element: Element, className: string): void {
  expect(element.classList.contains(className)).toBe(false);
}

/**
 * Asserts element is visible
 */
export function expectVisible(element: HTMLElement): void {
  const style = element.style;
  expect(style.display).not.toBe('none');
  expect(style.visibility).not.toBe('hidden');
}

/**
 * Asserts element is hidden
 */
export function expectHidden(element: HTMLElement): void {
  const style = element.style;
  const isHidden = style.display === 'none' || style.visibility === 'hidden';
  expect(isHidden).toBe(true);
}

/**
 * Asserts callback was called with specific arguments
 */
export function expectCalledWith(
  mockFn: jest.Mock,
  expectedArgs: any[]
): void {
  const calls = mockFn.mock.calls;
  const found = calls.some(call =>
    expectedArgs.every((arg, index) => {
      if (typeof arg === 'object') {
        return JSON.stringify(call[index]) === JSON.stringify(arg);
      }
      return call[index] === arg;
    })
  );

  expect(found).toBe(true);
  if (!found) {
    throw new Error(
      `Expected function to be called with ${JSON.stringify(expectedArgs)}, ` +
      `but actual calls were: ${JSON.stringify(calls)}`
    );
  }
}

/**
 * Asserts callback was called N times
 */
export function expectCallCount(mockFn: jest.Mock, expectedCount: number): void {
  const actualCount = mockFn.mock.calls.length;
  expect(actualCount).toBe(expectedCount);
  if (actualCount !== expectedCount) {
    throw new Error(
      `Expected function to be called ${expectedCount} times, ` +
      `but it was called ${actualCount} times`
    );
  }
}

/**
 * Asserts function was called in specific order
 */
export function expectCallOrder(mockFns: jest.Mock[]): void {
  const callTimes = mockFns.map(fn =>
    fn.mock.invocationCallOrder[0] || Infinity
  );

  for (let i = 1; i < callTimes.length; i++) {
    if (callTimes[i] <= callTimes[i - 1]) {
      throw new Error(
        `Expected functions to be called in order, ` +
        `but function ${i} was called before function ${i - 1}`
      );
    }
  }
}

/**
 * Asserts object matches partial structure
 */
export function expectPartialMatch<T extends object>(
  actual: T,
  expected: Partial<T>
): void {
  Object.entries(expected).forEach(([key, value]) => {
    expect((actual as any)[key]).toEqual(value);
  });
}

/**
 * Asserts array contains item matching predicate
 */
export function expectArrayContains<T>(
  array: T[],
  predicate: (item: T) => boolean
): void {
  const found = array.some(predicate);
  expect(found).toBe(true);
  if (!found) {
    throw new Error(
      `Expected array to contain item matching predicate, but none found`
    );
  }
}

/**
 * Asserts error was logged to console
 */
export function expectErrorLogged(errorMessage: string): void {
  expect(console.error).toHaveBeenCalled();
  const calls = (console.error as jest.Mock).mock.calls;
  const found = calls.some(call =>
    call.some(arg => String(arg).includes(errorMessage))
  );

  expect(found).toBe(true);
}

/**
 * Asserts no errors were logged
 */
export function expectNoErrors(): void {
  expect(console.error).not.toHaveBeenCalled();
}

/**
 * Custom matcher: toBeWithinRange
 */
export const toBeWithinRange = (received: number, min: number, max: number) => {
  const pass = received >= min && received <= max;
  return {
    pass,
    message: () =>
      pass
        ? `Expected ${received} not to be within range ${min}-${max}`
        : `Expected ${received} to be within range ${min}-${max}`
  };
};

/**
 * Custom matcher: toHaveShadowDOM
 */
export const toHaveShadowDOM = (received: Element) => {
  const pass = !!received.shadowRoot;
  return {
    pass,
    message: () =>
      pass
        ? `Expected element not to have shadow DOM`
        : `Expected element to have shadow DOM`
  };
};

/**
 * Custom matcher: toContainText
 */
export const toContainText = (received: Element | ShadowRoot, expectedText: string) => {
  const actualText = received.textContent || '';
  const pass = actualText.includes(expectedText);
  return {
    pass,
    message: () =>
      pass
        ? `Expected "${actualText}" not to contain "${expectedText}"`
        : `Expected "${actualText}" to contain "${expectedText}"`
  };
};

/**
 * Register custom matchers
 */
export function registerCustomMatchers(): void {
  expect.extend({
    toBeWithinRange,
    toHaveShadowDOM,
    toContainText
  });
}

// Extend Jest matchers type
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(min: number, max: number): R;
      toHaveShadowDOM(): R;
      toContainText(expectedText: string): R;
    }
  }
}
