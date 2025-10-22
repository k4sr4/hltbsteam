/**
 * DOM Testing Utilities
 *
 * Helper functions for setting up and manipulating the DOM in tests
 */

/**
 * Creates a mock DOM element with common properties
 */
export function createMockElement(tag: string = 'div'): HTMLElement {
  const element = document.createElement(tag);

  // Add commonly needed mock methods
  const mockElement = element as any;
  mockElement.attachShadow = jest.fn(function(this: any, init: ShadowRootInit) {
    const shadowRoot = document.createElement('div') as any;
    shadowRoot.mode = init.mode;
    shadowRoot.host = this;
    this.shadowRoot = shadowRoot;
    return shadowRoot;
  });

  return mockElement;
}

/**
 * Creates a mock Shadow DOM structure
 */
export function createMockShadowRoot(): ShadowRoot {
  const shadowRoot = document.createElement('div') as any;
  shadowRoot.mode = 'open';
  shadowRoot.host = createMockElement();
  shadowRoot.innerHTML = '';

  // Add Shadow DOM methods
  shadowRoot.appendChild = jest.fn(function(this: any, child: Node) {
    HTMLElement.prototype.appendChild.call(this, child);
    return child;
  });

  shadowRoot.removeChild = jest.fn(function(this: any, child: Node) {
    return HTMLElement.prototype.removeChild.call(this, child);
  });

  shadowRoot.querySelector = jest.fn(function(this: any, selector: string) {
    return HTMLElement.prototype.querySelector.call(this, selector);
  });

  shadowRoot.querySelectorAll = jest.fn(function(this: any, selector: string) {
    return HTMLElement.prototype.querySelectorAll.call(this, selector);
  });

  return shadowRoot as unknown as ShadowRoot;
}

/**
 * Sets up Steam Store page DOM structure
 */
export function setupStorePageDOM(): void {
  document.body.innerHTML = `
    <div class="game_page_background">
      <div class="page_content_ctn">
        <div class="page_content">
          <div class="rightcol">
            <div class="game_area_purchase">
              <h1>Buy Game</h1>
              <div class="game_purchase_action"></div>
            </div>
            <div class="game_details">
              <div class="details_block"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Add meta tags
  const metaTitle = document.createElement('meta');
  metaTitle.setAttribute('property', 'og:title');
  metaTitle.setAttribute('content', 'Test Game');
  document.head.appendChild(metaTitle);
}

/**
 * Sets up Steam Community page DOM structure
 */
export function setupCommunityPageDOM(): void {
  document.body.innerHTML = `
    <div class="apphub_background">
      <div class="apphub_Container">
        <div class="apphub_HomeHeaderContent">
          <div class="apphub_AppName" id="appHubAppName">Test Game</div>
        </div>
        <div class="apphub_AppIcon"></div>
      </div>
    </div>
  `;
}

/**
 * Sets up empty page (non-game page)
 */
export function setupEmptyPageDOM(): void {
  document.body.innerHTML = '<div class="home_page_content"></div>';
}

/**
 * Cleans up DOM after test
 */
export function cleanupDOM(): void {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
}

/**
 * Waits for Shadow DOM to be attached
 */
export async function waitForShadowDOM(
  hostElement: Element,
  timeout: number = 1000
): Promise<ShadowRoot> {
  const startTime = Date.now();

  while (!hostElement.shadowRoot && Date.now() - startTime < timeout) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  if (!hostElement.shadowRoot) {
    throw new Error('Shadow DOM not attached within timeout');
  }

  return hostElement.shadowRoot;
}

/**
 * Waits for element to appear in DOM
 */
export async function waitForElement(
  selector: string,
  timeout: number = 1000,
  container: Element | Document = document
): Promise<Element> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const element = container.querySelector(selector);
    if (element) {
      return element;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  throw new Error(`Element "${selector}" not found within timeout`);
}

/**
 * Waits for element to disappear from DOM
 */
export async function waitForElementRemoval(
  selector: string,
  timeout: number = 1000,
  container: Element | Document = document
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const element = container.querySelector(selector);
    if (!element) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  throw new Error(`Element "${selector}" still present after timeout`);
}

/**
 * Triggers a mutation observer callback manually
 */
export function triggerMutationObserver(
  observer: MutationObserver,
  mutations: MutationRecord[] = []
): void {
  const callback = (observer as any).callback;
  if (callback) {
    callback(mutations, observer);
  }
}

/**
 * Creates a mock MutationRecord
 */
export function createMockMutationRecord(
  overrides?: Partial<MutationRecord>
): MutationRecord {
  return {
    type: 'childList',
    target: document.body,
    addedNodes: [] as any,
    removedNodes: [] as any,
    previousSibling: null,
    nextSibling: null,
    attributeName: null,
    attributeNamespace: null,
    oldValue: null,
    ...overrides
  };
}

/**
 * Gets all text content from shadow DOM
 */
export function getShadowTextContent(shadowRoot: ShadowRoot): string {
  return shadowRoot.textContent || '';
}

/**
 * Gets computed style from shadow DOM element
 */
export function getShadowStyle(
  shadowRoot: ShadowRoot,
  selector: string
): CSSStyleDeclaration | null {
  const element = shadowRoot.querySelector(selector);
  if (!element) return null;

  // In JSDOM, we can't use getComputedStyle, so return inline styles
  return (element as HTMLElement).style;
}

/**
 * Asserts element has ARIA attribute
 */
export function expectAriaAttribute(
  element: Element,
  attribute: string,
  value?: string
): void {
  const fullAttribute = `aria-${attribute}`;
  expect(element.hasAttribute(fullAttribute)).toBe(true);

  if (value !== undefined) {
    expect(element.getAttribute(fullAttribute)).toBe(value);
  }
}

/**
 * Asserts element has role
 */
export function expectRole(element: Element, role: string): void {
  expect(element.getAttribute('role')).toBe(role);
}

/**
 * Creates a target element for injection testing
 */
export function createInjectionTarget(className: string = 'game_area_purchase'): HTMLElement {
  const element = document.createElement('div');
  element.className = className;

  // Add to DOM
  document.body.appendChild(element);

  return element;
}

/**
 * Simulates a click event
 */
export function simulateClick(element: Element): void {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window
  });
  element.dispatchEvent(event);
}

/**
 * Simulates a keyboard event
 */
export function simulateKeyboard(
  element: Element,
  key: string,
  eventType: 'keydown' | 'keyup' | 'keypress' = 'keydown'
): void {
  const event = new KeyboardEvent(eventType, {
    key,
    bubbles: true,
    cancelable: true
  });
  element.dispatchEvent(event);
}

/**
 * Gets all elements with a specific class in shadow DOM
 */
export function getShadowElementsByClass(
  shadowRoot: ShadowRoot,
  className: string
): Element[] {
  return Array.from(shadowRoot.querySelectorAll(`.${className}`));
}

/**
 * Checks if shadow DOM contains specific text
 */
export function shadowContainsText(shadowRoot: ShadowRoot, text: string): boolean {
  const content = getShadowTextContent(shadowRoot);
  return content.includes(text);
}

/**
 * Mock requestAnimationFrame for testing
 */
export function mockRequestAnimationFrame(): {
  execute: () => void;
  cancel: () => void;
  restore: () => void;
} {
  let callback: FrameRequestCallback | null = null;
  let rafId = 1;

  const originalRAF = global.requestAnimationFrame;
  const originalCAF = global.cancelAnimationFrame;

  global.requestAnimationFrame = jest.fn((cb: FrameRequestCallback) => {
    callback = cb;
    return rafId++;
  }) as any;

  global.cancelAnimationFrame = jest.fn((id: number) => {
    callback = null;
  }) as any;

  return {
    execute: () => {
      if (callback) {
        callback(performance.now());
        callback = null;
      }
    },
    cancel: () => {
      callback = null;
    },
    restore: () => {
      global.requestAnimationFrame = originalRAF;
      global.cancelAnimationFrame = originalCAF;
    }
  };
}
