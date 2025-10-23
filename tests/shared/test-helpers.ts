/**
 * Test Helpers for Error Handling Tests
 *
 * Provides factory functions and utilities for creating test data
 * and managing test state across error handling tests.
 */

import {
  HLTBError,
  DatabaseLoadError,
  GameNotFoundError,
  LowConfidenceMatchError,
  SteamPageDetectionError,
  DOMInjectionError,
  StorageError,
  ValidationError
} from '../../src/shared/errors';
import type { ErrorLogEntry } from '../../src/shared/error-handler';

/**
 * Create a mock HLTBError with default values
 */
export function createMockHLTBError(
  overrides: Partial<HLTBError> = {}
): HLTBError {
  const defaults = {
    message: 'Test error',
    code: 'TEST_ERROR',
    recoverable: true,
    userMessage: 'User-friendly test error'
  };

  const merged = { ...defaults, ...overrides };
  return new HLTBError(
    merged.message,
    merged.code,
    merged.recoverable,
    merged.userMessage
  );
}

/**
 * Create a mock error log with specified number of entries
 */
export function createMockErrorLog(
  count: number = 5,
  errorTypes?: Array<'recoverable' | 'critical'>
): ErrorLogEntry[] {
  return Array.from({ length: count }, (_, i) => {
    const isRecoverable = errorTypes
      ? errorTypes[i % errorTypes.length] === 'recoverable'
      : i % 2 === 0;

    return {
      timestamp: Date.now() - (i * 1000),
      message: `Error ${i}`,
      code: isRecoverable ? 'GAME_NOT_FOUND' : 'DATABASE_LOAD_ERROR',
      name: 'HLTBError',
      recoverable: isRecoverable,
      context: { testIndex: i },
      userMessage: `User message ${i}`
    };
  });
}

/**
 * Wait for async operations to complete
 */
export function waitForAsync(ms: number = 50): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Setup window mocks for testing global error handlers
 */
export function setupWindowMocks() {
  const errorListeners: Array<(event: any) => void> = [];
  const rejectionListeners: Array<(event: any) => void> = [];

  (global as any).window = {
    addEventListener: jest.fn((event: string, handler: any) => {
      if (event === 'error') errorListeners.push(handler);
      if (event === 'unhandledrejection') rejectionListeners.push(handler);
    }),
    removeEventListener: jest.fn()
  };

  return {
    triggerError: (message: string, filename: string = 'test.js') => {
      errorListeners.forEach(listener =>
        listener({
          message,
          filename,
          lineno: 1,
          colno: 1
        })
      );
    },
    triggerRejection: (reason: any) => {
      rejectionListeners.forEach(listener =>
        listener({ reason })
      );
    },
    getListenerCount: () => ({
      error: errorListeners.length,
      rejection: rejectionListeners.length
    })
  };
}

/**
 * Mock Chrome storage operations with specific behaviors
 */
export function mockChromeStorage(scenario: 'success' | 'error' | 'corruption') {
  switch (scenario) {
    case 'success':
      (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
      (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);
      (chrome.storage.local.remove as jest.Mock).mockResolvedValue(undefined);
      break;

    case 'error':
      (chrome.storage.local.get as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      );
      (chrome.storage.local.set as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      );
      break;

    case 'corruption':
      (chrome.storage.local.get as jest.Mock).mockResolvedValue({
        match_cache: 'corrupted_json_string'
      });
      break;
  }
}

/**
 * Reset ErrorHandler singleton for testing
 */
export function resetErrorHandler() {
  // Access private static instance through type assertion
  (global as any).ErrorHandler = undefined;

  // Clear error logs if ErrorHandler is imported
  try {
    const ErrorHandler = require('../../src/shared/error-handler').ErrorHandler;
    (ErrorHandler as any).instance = null;
  } catch (e) {
    // ErrorHandler not loaded yet, ignore
  }
}

/**
 * Capture console output for testing
 */
export function captureConsole() {
  const logs: string[] = [];
  const errors: string[] = [];
  const warns: string[] = [];

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = jest.fn((...args) => {
    logs.push(args.map(String).join(' '));
  });

  console.error = jest.fn((...args) => {
    errors.push(args.map(String).join(' '));
  });

  console.warn = jest.fn((...args) => {
    warns.push(args.map(String).join(' '));
  });

  return {
    getLogs: () => [...logs],
    getErrors: () => [...errors],
    getWarns: () => [...warns],
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    }
  };
}

/**
 * Test data: Valid game info
 */
export const VALID_GAME_INFO = {
  appId: '12345',
  title: 'Test Game'
};

/**
 * Test data: Invalid game info
 */
export const INVALID_GAME_INFO = {
  invalidAppId: { appId: 'abc123', title: 'Invalid' },
  missingAppId: { appId: '', title: 'No App ID' },
  missingTitle: { appId: '12345', title: '' },
  xssAttempt: { appId: '12345', title: '<script>alert("xss")</script>' }
};

/**
 * Test data: Valid HLTB data
 */
export const VALID_HLTB_DATA = {
  mainStory: 10,
  mainExtra: 20,
  completionist: 30,
  allStyles: 25
};

/**
 * Test data: Invalid HLTB data
 */
export const INVALID_HLTB_DATA = {
  wrongTypes: { mainStory: 'ten', mainExtra: '20', completionist: null },
  negativeValues: { mainStory: -1, mainExtra: -5, completionist: -10 },
  missingData: {}
};

/**
 * Test data: Cache entries
 */
export const CACHE_ENTRIES = {
  fresh: {
    data: VALID_HLTB_DATA,
    timestamp: Date.now(),
    gameTitle: 'Test Game'
  },
  expired: {
    data: VALID_HLTB_DATA,
    timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000), // 8 days old
    gameTitle: 'Old Game'
  },
  corrupted: 'not_a_valid_cache_object'
};

/**
 * Create all types of custom errors for testing
 */
export const ERROR_SAMPLES = {
  databaseLoad: () => new DatabaseLoadError('DB load failed'),
  gameNotFound: () => new GameNotFoundError('Test Game'),
  lowConfidence: () => new LowConfidenceMatchError('Test Game', 45),
  pageDetection: () => new SteamPageDetectionError('Detection failed', 3),
  domInjection: () => new DOMInjectionError('Injection failed', ['.selector1', '.selector2']),
  storage: () => new StorageError('Storage failed', 'get'),
  validation: () => new ValidationError('Invalid data', 'appId', 'abc'),
  generic: () => new Error('Generic error'),
  network: () => {
    const err = new Error('Network failed');
    err.name = 'NetworkError';
    return err;
  }
};

/**
 * Assert error log contains specific error
 */
export function assertErrorLogged(
  errorLog: ErrorLogEntry[],
  code: string,
  message?: string
): boolean {
  const found = errorLog.find(entry => {
    const codeMatches = entry.code === code;
    const messageMatches = message ? entry.message.includes(message) : true;
    return codeMatches && messageMatches;
  });

  return found !== undefined;
}

/**
 * Create mock DOM structure for Steam pages
 */
export function createSteamPageDOM(pageType: 'store' | 'community' = 'store') {
  document.body.innerHTML = '';

  if (pageType === 'store') {
    document.body.innerHTML = `
      <div class="page_content">
        <div class="rightcol">
          <div class="game_area_purchase">
            <div class="game_purchase_action">
              <!-- Purchase area -->
            </div>
          </div>
        </div>
        <div class="leftcol">
          <div class="game_area_description">
            <!-- Game description -->
          </div>
        </div>
      </div>
    `;
  } else {
    document.body.innerHTML = `
      <div class="apphub_Container">
        <div class="apphub_HeaderTop">
          <div class="apphub_AppName" id="appHubAppName">Test Game</div>
        </div>
        <div class="apphub_HomeHeader">
          <!-- Community header -->
        </div>
      </div>
    `;
  }
}

/**
 * Setup Steam page URL
 */
export function setSteamURL(appId: string, gameName: string) {
  Object.defineProperty(window, 'location', {
    value: {
      href: `https://store.steampowered.com/app/${appId}/${gameName}/`
    },
    writable: true,
    configurable: true
  });
}

/**
 * Simulate Chrome extension context invalidation
 */
export function simulateContextInvalidation() {
  (chrome.runtime.sendMessage as jest.Mock).mockRejectedValue(
    new Error('Extension context invalidated')
  );
}

/**
 * Simulate network timeout
 */
export function simulateNetworkTimeout(delayMs: number = 5000) {
  (chrome.runtime.sendMessage as jest.Mock).mockImplementation(
    () => new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Network timeout')), delayMs)
    )
  );
}
