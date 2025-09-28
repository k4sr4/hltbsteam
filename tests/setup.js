// Jest setup file for Chrome extension testing
// Mocks Chrome APIs and performance APIs for all test files

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

// Create a global chrome object with all necessary APIs
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    },
    sendMessage: jest.fn().mockImplementation(() =>
      Promise.resolve({ success: true })
    ),
    lastError: null
  },

  storage: {
    local: {
      get: jest.fn().mockImplementation((keys) =>
        Promise.resolve({})
      ),
      set: jest.fn().mockImplementation(() =>
        Promise.resolve()
      ),
      remove: jest.fn().mockImplementation(() =>
        Promise.resolve()
      ),
      clear: jest.fn().mockImplementation(() =>
        Promise.resolve()
      )
    },
    sync: {
      get: jest.fn().mockImplementation(() =>
        Promise.resolve({})
      ),
      set: jest.fn().mockImplementation(() =>
        Promise.resolve()
      )
    }
  },

  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    clearAll: jest.fn(),
    onAlarm: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },

  tabs: {
    create: jest.fn(),
    query: jest.fn().mockImplementation(() =>
      Promise.resolve([])
    ),
    sendMessage: jest.fn()
  }
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Helper function to reset all mocks between tests
global.resetChromeMocks = () => {
  Object.keys(global.chrome).forEach(api => {
    if (global.chrome[api]) {
      Object.keys(global.chrome[api]).forEach(method => {
        if (typeof global.chrome[api][method] === 'function') {
          global.chrome[api][method].mockClear();
        } else if (global.chrome[api][method] && global.chrome[api][method].addListener) {
          global.chrome[api][method].addListener.mockClear();
          if (global.chrome[api][method].removeListener) {
            global.chrome[api][method].removeListener.mockClear();
          }
        }
      });
    }
  });
};

// Mock DOM elements for content script tests
global.document = {
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(),
  createElement: jest.fn().mockImplementation((tag) => ({
    tagName: tag.toUpperCase(),
    className: '',
    innerHTML: '',
    style: {},
    parentNode: {
      insertBefore: jest.fn()
    },
    appendChild: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  })),
  title: 'Test Game on Steam',
  body: {
    appendChild: jest.fn()
  }
};

// Ensure DOM methods are proper Jest mocks
Object.defineProperty(global.document, 'querySelector', {
  value: jest.fn(),
  writable: true
});
Object.defineProperty(global.document, 'querySelectorAll', {
  value: jest.fn(),
  writable: true
});
Object.defineProperty(global.document, 'createElement', {
  value: jest.fn().mockImplementation((tag) => ({
    tagName: tag.toUpperCase(),
    className: '',
    innerHTML: '',
    style: {},
    parentNode: {
      insertBefore: jest.fn()
    },
    appendChild: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  })),
  writable: true
});

global.window = {
  location: {
    href: 'https://store.steampowered.com/app/123456/Test_Game/'
  }
};

// Mock MutationObserver for content script tests
global.MutationObserver = jest.fn().mockImplementation((callback) => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  takeRecords: jest.fn(() => [])
}));

// Custom Jest matchers
expect.extend({
  toBeOneOf(received, expected) {
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

// Export for use in tests if needed
module.exports = {
  resetChromeMocks
};