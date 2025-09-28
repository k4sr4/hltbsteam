/**
 * Enhanced TypeScript test setup for Jest
 * Configures DOM environment, mocks, and utilities for the Steam detection test suite
 */

import 'jest-environment-jsdom';

// Enhanced Performance API mock
const mockPerformance = {
  now: jest.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 1024 * 1024, // 1MB
    totalJSHeapSize: 10 * 1024 * 1024, // 10MB
    jsHeapSizeLimit: 100 * 1024 * 1024 // 100MB
  },
  timeOrigin: Date.now(),
  mark: jest.fn(),
  measure: jest.fn(),
  clearMarks: jest.fn(),
  clearMeasures: jest.fn(),
  getEntries: jest.fn(() => []),
  getEntriesByName: jest.fn(() => []),
  getEntriesByType: jest.fn(() => []),
  toJSON: jest.fn()
};

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
});

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    sendMessage: jest.fn().mockResolvedValue({ success: true, data: {} }),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    lastError: null
  },
  storage: {
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(),
      remove: jest.fn().mockResolvedValue(),
      clear: jest.fn().mockResolvedValue()
    }
  }
};

Object.defineProperty(global, 'chrome', {
  value: mockChrome,
  writable: true
});

// Mock MutationObserver
const mockMutationObserver = jest.fn().mockImplementation((callback) => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  takeRecords: jest.fn(() => [])
}));

Object.defineProperty(global, 'MutationObserver', {
  value: mockMutationObserver,
  writable: true
});

// Mock console methods to reduce noise in tests (but keep error and warn for debugging)
const originalConsole = global.console;
Object.defineProperty(global, 'console', {
  value: {
    ...originalConsole,
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  },
  writable: true
});

// Setup DOM environment defaults
beforeEach(() => {
  // Reset document state
  document.head.innerHTML = '';
  document.body.innerHTML = '';

  // Reset document properties
  Object.defineProperty(document, 'readyState', {
    value: 'complete',
    configurable: true,
    writable: true
  });

  // Reset location
  Object.defineProperty(window, 'location', {
    value: {
      href: 'https://store.steampowered.com/',
      hostname: 'store.steampowered.com',
      pathname: '/',
      search: '',
      hash: '',
      protocol: 'https:',
      toString: () => 'https://store.steampowered.com/'
    },
    configurable: true,
    writable: true
  });

  // Reset timers
  jest.clearAllTimers();
  jest.clearAllMocks();
});

// Clean up after each test
afterEach(() => {
  // Clean up DOM
  document.head.innerHTML = '';
  document.body.innerHTML = '';

  // Clean up any remaining timers
  jest.clearAllTimers();
});

// Custom Jest matchers
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be one of ${expected.join(', ')}`
          : `Expected ${received} to be one of ${expected.join(', ')}`
    };
  }
});

// Type augmentation for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
    }
  }
}

// Global test utilities
export const TestUtils = {
  /**
   * Wait for next tick in event loop
   */
  nextTick: (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0)),

  /**
   * Wait for specified delay
   */
  delay: (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Create a mock element with specified attributes
   */
  createElement: (tagName: string, attributes: Record<string, string> = {}, textContent?: string): HTMLElement => {
    const element = document.createElement(tagName);
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    if (textContent) {
      element.textContent = textContent;
    }
    return element;
  },

  /**
   * Mock a successful Chrome API response
   */
  mockChromeResponse: (data: any = {}) => {
    (mockChrome.runtime.sendMessage as jest.MockedFunction<any>).mockResolvedValueOnce({
      success: true,
      data
    });
  },

  /**
   * Mock a Chrome API error
   */
  mockChromeError: (error: string) => {
    (mockChrome.runtime.sendMessage as jest.MockedFunction<any>).mockResolvedValueOnce({
      success: false,
      error
    });
  }
};

// Export test utilities for use in test files
export default TestUtils;

// Log test environment setup
console.log('🧪 Steam Detection Test Suite initialized');
console.log('📊 Performance monitoring enabled');
console.log('🌐 DOM environment configured');
console.log('🔧 Chrome APIs mocked');