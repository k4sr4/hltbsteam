# Error Handling Test Strategy
## HLTB Steam Extension - Comprehensive Testing Plan

**Version**: 1.0
**Last Updated**: 2025-10-22
**Author**: Claude (Test Strategy Architect)

---

## Table of Contents

1. [Test Architecture Overview](#test-architecture-overview)
2. [Test Pyramid Distribution](#test-pyramid-distribution)
3. [Test File Organization](#test-file-organization)
4. [Mock Strategies](#mock-strategies)
5. [Test Scenarios by Component](#test-scenarios-by-component)
6. [Coverage Targets](#coverage-targets)
7. [CI/CD Integration](#cicd-integration)
8. [Example Test Implementations](#example-test-implementations)
9. [Maintenance Guidelines](#maintenance-guidelines)

---

## Test Architecture Overview

### Error Handling System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Error Handling System                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────────┐  │
│  │ Custom Error │  │ ErrorHandler  │  │ Safe Execute    │  │
│  │ Classes      │  │ Singleton     │  │ Utilities       │  │
│  └──────┬───────┘  └───────┬───────┘  └────────┬────────┘  │
│         │                  │                    │           │
│         └──────────────────┼────────────────────┘           │
│                            │                                │
├────────────────────────────┼────────────────────────────────┤
│                    Integration Layer                         │
├────────────────────────────┼────────────────────────────────┤
│         │                  │                    │           │
│  ┌──────▼───────┐  ┌───────▼───────┐  ┌────────▼────────┐  │
│  │ Content      │  │ Background    │  │ Popup           │  │
│  │ Script       │  │ Service       │  │ Interface       │  │
│  └──────────────┘  └───────────────┘  └─────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Test Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ E2E Tests (10%)                                              │
│ - Critical error recovery flows                              │
│ - User notification display                                  │
│ - Cross-component error propagation                          │
└─────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────┐
│ Integration Tests (20%)                                      │
│ - Content script error handling                              │
│ - Background service error handling                          │
│ - Message passing with errors                                │
│ - Storage operations with errors                             │
└─────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────┐
│ Unit Tests (70%)                                             │
│ - Error class constructors and properties                    │
│ - ErrorHandler methods                                       │
│ - Safe execution wrappers                                    │
│ - Error recovery mechanisms                                  │
│ - Type guards and utility functions                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Test Pyramid Distribution

### Target Test Count: 85-95 Tests

| Layer | Percentage | Count | Focus Areas |
|-------|-----------|-------|-------------|
| **Unit Tests** | 70% | 60-67 tests | Error classes, ErrorHandler methods, safe wrappers, utilities |
| **Integration Tests** | 20% | 17-19 tests | Component error flows, message passing, storage operations |
| **E2E Tests** | 10% | 8-9 tests | Critical user-facing error scenarios, recovery flows |

### Why This Distribution?

1. **Unit Tests (70%)**: Error handling logic is highly testable in isolation
   - Each error class needs constructor and property tests
   - ErrorHandler has many individual methods to test
   - Safe wrappers have clear input/output contracts
   - Fast execution, easy to debug

2. **Integration Tests (20%)**: Error flows cross component boundaries
   - Content script catches errors from background service
   - Background service validates and throws errors
   - Storage operations can fail in multiple ways
   - Message passing needs error handling on both ends

3. **E2E Tests (10%)**: Focus on user experience
   - User sees error notifications
   - Extension continues working after recoverable errors
   - Critical errors properly halt execution
   - Error logs are accessible for debugging

---

## Test File Organization

### Directory Structure

```
tests/
├── setup.js                          # Existing Chrome API mocks
├── shared/                           # Error handling unit tests
│   ├── errors.test.ts               # Custom error classes (15 tests)
│   ├── error-handler.test.ts        # ErrorHandler singleton (25 tests)
│   ├── safe-execute.test.ts         # Safe wrappers (20 tests)
│   └── test-helpers.ts              # Shared test utilities
├── integration/                      # Integration tests
│   ├── content-error-handling.test.ts    # Content script errors (8 tests)
│   ├── background-error-handling.test.ts # Background service errors (6 tests)
│   ├── message-passing-errors.test.ts    # Message errors (5 tests)
│   └── storage-errors.test.ts            # Storage operation errors (NEW)
├── e2e/                             # End-to-end scenarios
│   ├── error-recovery.test.ts       # Recovery flows (4 tests)
│   ├── user-notifications.test.ts   # User-facing errors (3 tests)
│   └── critical-errors.test.ts      # Critical error handling (2 tests)
└── mocks/                           # Additional mocks
    ├── chrome-error-mocks.ts        # Chrome API error scenarios
    └── test-data.ts                 # Test error data
```

### Naming Conventions

- **Test Files**: `<component>.test.ts`
- **Test Suites**: `describe('<Component> - <Feature>')`
- **Test Cases**: `test('should <expected behavior> when <condition>')`
- **Mock Files**: `<component>-mocks.ts`

---

## Mock Strategies

### 1. Chrome API Mocks (Extend Existing)

**Location**: `tests/setup.js` (already exists)

**Add Error Scenarios**:

```javascript
// tests/setup.js - Add error simulation helpers
global.simulateChromeStorageError = (operation, errorMessage = 'Storage error') => {
  const error = new Error(errorMessage);
  chrome.storage.local[operation].mockRejectedValueOnce(error);
};

global.simulateChromeSendMessageError = (errorMessage = 'Message failed') => {
  chrome.runtime.sendMessage.mockRejectedValueOnce(new Error(errorMessage));
};

global.simulateChromeStorageCorruption = () => {
  chrome.storage.local.get.mockResolvedValueOnce({
    match_cache: 'invalid_json_string'
  });
};

// Add to resetChromeMocks
global.simulateChromeOffline = () => {
  chrome.runtime.sendMessage.mockRejectedValue(
    new Error('Extension context invalidated')
  );
};
```

### 2. Window/Global Object Mocks

**Purpose**: Test global error handlers

```typescript
// tests/mocks/window-mocks.ts
export function setupWindowMocks() {
  const errorListeners: Array<(event: any) => void> = [];
  const rejectionListeners: Array<(event: any) => void> = [];

  global.window = {
    addEventListener: jest.fn((event, handler) => {
      if (event === 'error') errorListeners.push(handler);
      if (event === 'unhandledrejection') rejectionListeners.push(handler);
    }),
    removeEventListener: jest.fn()
  } as any;

  return {
    triggerError: (message: string) => {
      errorListeners.forEach(listener =>
        listener({ message, filename: 'test.js', lineno: 1, colno: 1 })
      );
    },
    triggerRejection: (reason: any) => {
      rejectionListeners.forEach(listener =>
        listener({ reason })
      );
    }
  };
}
```

### 3. Error Instance Mocks

**Purpose**: Test error handling with different error types

```typescript
// tests/mocks/error-mocks.ts
export const mockErrors = {
  network: new Error('Network request failed'),
  timeout: new Error('Operation timed out'),
  validation: new Error('Invalid input'),
  storage: new Error('QuotaExceededError'),
  chromeRuntime: new Error('Extension context invalidated'),
  generic: new Error('Something went wrong')
};

// Make network error look like NetworkError
mockErrors.network.name = 'NetworkError';

export function createMockHLTBError(
  message: string,
  code: string,
  recoverable: boolean = true
) {
  const error = new Error(message) as any;
  error.name = 'HLTBError';
  error.code = code;
  error.recoverable = recoverable;
  error.userMessage = `User-friendly: ${message}`;
  return error;
}
```

### 4. Test Data Fixtures

**Purpose**: Consistent test data across tests

```typescript
// tests/mocks/test-data.ts
export const testGameInfo = {
  valid: {
    appId: '12345',
    title: 'Test Game'
  },
  invalid: {
    appId: 'abc', // Not numeric
    title: '<script>alert("xss")</script>' // Malicious
  },
  missing: {
    appId: '99999',
    title: 'Unknown Game'
  }
};

export const testHLTBData = {
  valid: {
    mainStory: 10,
    mainExtra: 20,
    completionist: 30
  },
  corrupted: {
    mainStory: 'invalid',
    mainExtra: null,
    completionist: -1
  }
};

export const testCacheData = {
  fresh: {
    data: testHLTBData.valid,
    timestamp: Date.now(),
    gameTitle: 'Test Game'
  },
  expired: {
    data: testHLTBData.valid,
    timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000), // 8 days old
    gameTitle: 'Old Game'
  }
};
```

---

## Test Scenarios by Component

### A. Custom Error Classes (15 tests)

**File**: `tests/shared/errors.test.ts`

#### 1. HLTBError Base Class (3 tests)

```typescript
describe('HLTBError Base Class', () => {
  test('should create error with all properties', () => {
    const error = new HLTBError('Test error', 'TEST_CODE', true, 'User message');

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.recoverable).toBe(true);
    expect(error.userMessage).toBe('User message');
    expect(error.name).toBe('HLTBError');
    expect(error.stack).toBeDefined();
  });

  test('should default recoverable to true when not specified', () => {
    const error = new HLTBError('Test', 'CODE');
    expect(error.recoverable).toBe(true);
  });

  test('should be instance of Error', () => {
    const error = new HLTBError('Test', 'CODE');
    expect(error instanceof Error).toBe(true);
  });
});
```

#### 2. DatabaseLoadError (2 tests)

```typescript
describe('DatabaseLoadError', () => {
  test('should create non-recoverable error with original error', () => {
    const originalError = new Error('File not found');
    const error = new DatabaseLoadError('Failed to load DB', originalError);

    expect(error.code).toBe('DATABASE_LOAD_ERROR');
    expect(error.recoverable).toBe(false);
    expect(error.originalError).toBe(originalError);
    expect(error.userMessage).toContain('Failed to load HLTB database');
  });

  test('should work without original error', () => {
    const error = new DatabaseLoadError('DB error');
    expect(error.originalError).toBeUndefined();
  });
});
```

#### 3. GameNotFoundError (2 tests)

```typescript
describe('GameNotFoundError', () => {
  test('should include game title in message and properties', () => {
    const error = new GameNotFoundError('Cyberpunk 2077');

    expect(error.gameTitle).toBe('Cyberpunk 2077');
    expect(error.message).toContain('Cyberpunk 2077');
    expect(error.code).toBe('GAME_NOT_FOUND');
    expect(error.recoverable).toBe(true);
  });

  test('should have user-friendly message', () => {
    const error = new GameNotFoundError('Test Game');
    expect(error.userMessage).toContain('No completion time data available');
  });
});
```

#### 4. LowConfidenceMatchError (2 tests)

```typescript
describe('LowConfidenceMatchError', () => {
  test('should include confidence score', () => {
    const error = new LowConfidenceMatchError('Test Game', 45);

    expect(error.gameTitle).toBe('Test Game');
    expect(error.confidence).toBe(45);
    expect(error.message).toContain('45%');
    expect(error.recoverable).toBe(true);
  });

  test('should format confidence in user message', () => {
    const error = new LowConfidenceMatchError('Game', 60);
    expect(error.userMessage).toContain('60%');
  });
});
```

#### 5. Other Error Classes (6 tests - 2 each for SteamPageDetectionError, DOMInjectionError, StorageError, ValidationError)

```typescript
// Similar pattern for each error class
describe('SteamPageDetectionError', () => {
  test('should include detection attempts', () => {
    const error = new SteamPageDetectionError('No game found', 3);
    expect(error.detectionAttempts).toBe(3);
  });

  test('should be recoverable', () => {
    const error = new SteamPageDetectionError('Error');
    expect(error.recoverable).toBe(true);
  });
});

// ... Similar for DOMInjectionError, StorageError, ValidationError
```

### B. ErrorHandler Singleton (25 tests)

**File**: `tests/shared/error-handler.test.ts`

#### 1. Singleton Pattern (3 tests)

```typescript
describe('ErrorHandler - Singleton Pattern', () => {
  test('should return same instance on multiple calls', () => {
    const instance1 = ErrorHandler.getInstance();
    const instance2 = ErrorHandler.getInstance();
    expect(instance1).toBe(instance2);
  });

  test('should accept configuration on first instantiation', () => {
    // Reset singleton for test
    (ErrorHandler as any).instance = null;

    const instance = ErrorHandler.getInstance({
      maxLogSize: 50,
      enableConsoleLogging: false
    });

    expect(instance).toBeDefined();
  });

  test('should use default config if none provided', () => {
    (ErrorHandler as any).instance = null;
    const instance = ErrorHandler.getInstance();
    expect(instance).toBeDefined();
  });
});
```

#### 2. Error Handling (5 tests)

```typescript
describe('ErrorHandler - Error Handling', () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    (ErrorHandler as any).instance = null;
    handler = ErrorHandler.getInstance({
      enableConsoleLogging: false,
      enableStoragePersistence: false
    });
    jest.clearAllMocks();
  });

  test('should log error to console when enabled', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (ErrorHandler as any).instance = null;

    const handler = ErrorHandler.getInstance({ enableConsoleLogging: true });
    handler.handleError(new Error('Test error'), { context: 'test' });

    expect(consoleSpy).toHaveBeenCalledWith(
      '[HLTB Error]',
      expect.any(Error),
      { context: 'test' }
    );
  });

  test('should add error to error log', () => {
    const error = new Error('Test error');
    handler.handleError(error);

    const log = handler.getErrorLog();
    expect(log).toHaveLength(1);
    expect(log[0].message).toBe('Test error');
  });

  test('should handle HLTBError specially', () => {
    const error = new GameNotFoundError('Test Game');
    handler.handleError(error);

    const log = handler.getErrorLog();
    expect(log[0].code).toBe('GAME_NOT_FOUND');
    expect(log[0].recoverable).toBe(true);
  });

  test('should persist to storage when enabled', () => {
    (ErrorHandler as any).instance = null;
    const handler = ErrorHandler.getInstance({
      enableStoragePersistence: true
    });

    handler.handleError(new Error('Test'));

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        errorLog: expect.any(Array)
      })
    );
  });

  test('should report critical errors when enabled', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    (ErrorHandler as any).instance = null;

    const handler = ErrorHandler.getInstance({
      enableErrorReporting: true
    });

    const criticalError = new DatabaseLoadError('DB failed');
    handler.handleError(criticalError);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Would report critical error'),
      expect.any(Object)
    );
  });
});
```

#### 3. Global Error Handlers (3 tests)

```typescript
describe('ErrorHandler - Global Handlers', () => {
  test('should setup window error listener', () => {
    (ErrorHandler as any).instance = null;

    const addEventListenerSpy = jest.fn();
    global.window = { addEventListener: addEventListenerSpy } as any;

    ErrorHandler.getInstance();

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'error',
      expect.any(Function)
    );
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'unhandledrejection',
      expect.any(Function)
    );
  });

  test('should handle uncaught errors', () => {
    (ErrorHandler as any).instance = null;

    let errorHandler: Function;
    global.window = {
      addEventListener: jest.fn((event, handler) => {
        if (event === 'error') errorHandler = handler;
      })
    } as any;

    const handler = ErrorHandler.getInstance({
      enableConsoleLogging: false
    });

    errorHandler!({ message: 'Uncaught error', filename: 'test.js', lineno: 1, colno: 1 });

    const log = handler.getErrorLog();
    expect(log.length).toBeGreaterThan(0);
  });

  test('should handle unhandled promise rejections', () => {
    (ErrorHandler as any).instance = null;

    let rejectionHandler: Function;
    global.window = {
      addEventListener: jest.fn((event, handler) => {
        if (event === 'unhandledrejection') rejectionHandler = handler;
      })
    } as any;

    const handler = ErrorHandler.getInstance({
      enableConsoleLogging: false
    });

    rejectionHandler!({ reason: new Error('Promise rejected') });

    const log = handler.getErrorLog();
    expect(log.length).toBeGreaterThan(0);
  });
});
```

#### 4. Recovery Mechanisms (5 tests)

```typescript
describe('ErrorHandler - Recovery Mechanisms', () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    (ErrorHandler as any).instance = null;
    handler = ErrorHandler.getInstance({
      enableConsoleLogging: false,
      enableStoragePersistence: false
    });
  });

  test('should log missing game for GameNotFoundError', () => {
    chrome.storage.local.get.mockResolvedValue({ missing_games: [] });

    const error = new GameNotFoundError('New Game');
    handler.handleError(error);

    // Wait for async operation
    return new Promise(resolve => setTimeout(resolve, 50)).then(() => {
      expect(chrome.storage.local.get).toHaveBeenCalledWith('missing_games');
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          missing_games: expect.arrayContaining(['New Game'])
        })
      );
    });
  });

  test('should not duplicate missing games', () => {
    chrome.storage.local.get.mockResolvedValue({
      missing_games: ['Existing Game']
    });

    const error = new GameNotFoundError('Existing Game');
    handler.handleError(error);

    return new Promise(resolve => setTimeout(resolve, 50)).then(() => {
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
  });

  test('should clear cache for StorageError', () => {
    const error = new StorageError('Cache corrupted', 'get');
    handler.handleError(error);

    return new Promise(resolve => setTimeout(resolve, 50)).then(() => {
      expect(chrome.storage.local.remove).toHaveBeenCalledWith(['match_cache']);
    });
  });

  test('should trim missing games list to 100 entries', () => {
    const existingGames = Array.from({ length: 100 }, (_, i) => `Game ${i}`);
    chrome.storage.local.get.mockResolvedValue({
      missing_games: existingGames
    });

    const error = new GameNotFoundError('New Game');
    handler.handleError(error);

    return new Promise(resolve => setTimeout(resolve, 50)).then(() => {
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          missing_games: expect.arrayContaining(['New Game'])
        })
      );

      const savedGames = (chrome.storage.local.set as jest.Mock).mock.calls[0][0].missing_games;
      expect(savedGames.length).toBe(100);
    });
  });

  test('should not attempt recovery for non-recoverable errors', () => {
    const error = new DatabaseLoadError('Critical failure');
    handler.handleError(error);

    // No storage operations should be called for non-recoverable errors
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
});
```

#### 5. Error Log Management (5 tests)

```typescript
describe('ErrorHandler - Error Log Management', () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    (ErrorHandler as any).instance = null;
    handler = ErrorHandler.getInstance({
      maxLogSize: 5,
      enableConsoleLogging: false,
      enableStoragePersistence: false
    });
  });

  test('should add errors to log', () => {
    handler.handleError(new Error('Error 1'));
    handler.handleError(new Error('Error 2'));

    const log = handler.getErrorLog();
    expect(log).toHaveLength(2);
  });

  test('should trim log when max size exceeded', () => {
    for (let i = 0; i < 10; i++) {
      handler.handleError(new Error(`Error ${i}`));
    }

    const log = handler.getErrorLog();
    expect(log).toHaveLength(5); // maxLogSize
    expect(log[0].message).toBe('Error 5'); // Oldest removed
  });

  test('should include timestamp and stack trace', () => {
    handler.handleError(new Error('Test error'));

    const log = handler.getErrorLog();
    expect(log[0].timestamp).toBeDefined();
    expect(log[0].stack).toBeDefined();
  });

  test('should clear error log', () => {
    handler.handleError(new Error('Test'));
    handler.clearErrorLog();

    expect(handler.getErrorLog()).toHaveLength(0);
  });

  test('should return error statistics', () => {
    handler.handleError(new GameNotFoundError('Game 1'));
    handler.handleError(new DatabaseLoadError('DB error'));
    handler.handleError(new GameNotFoundError('Game 2'));

    const stats = handler.getErrorStats();
    expect(stats.total).toBe(3);
    expect(stats.recoverable).toBe(2);
    expect(stats.critical).toBe(1);
    expect(stats.byType['GAME_NOT_FOUND']).toBe(2);
    expect(stats.byType['DATABASE_LOAD_ERROR']).toBe(1);
  });
});
```

#### 6. User Notifications (4 tests)

```typescript
describe('ErrorHandler - User Notifications', () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    (ErrorHandler as any).instance = null;
    handler = ErrorHandler.getInstance();
    jest.clearAllMocks();
  });

  test('should send notification to active tab', () => {
    chrome.tabs.query.mockResolvedValue([{ id: 123 }]);

    handler.showUserNotification('Test message', 'error');

    return new Promise(resolve => setTimeout(resolve, 50)).then(() => {
      expect(chrome.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true
      });
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        123,
        {
          action: 'showNotification',
          message: 'Test message',
          type: 'error'
        }
      );
    });
  });

  test('should handle notification types', () => {
    chrome.tabs.query.mockResolvedValue([{ id: 123 }]);

    handler.showUserNotification('Warning', 'warning');

    return new Promise(resolve => setTimeout(resolve, 50)).then(() => {
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        123,
        expect.objectContaining({ type: 'warning' })
      );
    });
  });

  test('should not fail if no active tab', () => {
    chrome.tabs.query.mockResolvedValue([]);

    expect(() => {
      handler.showUserNotification('Test', 'info');
    }).not.toThrow();
  });

  test('should ignore content script errors silently', () => {
    chrome.tabs.query.mockResolvedValue([{ id: 123 }]);
    chrome.tabs.sendMessage.mockRejectedValue(new Error('No content script'));

    expect(() => {
      handler.showUserNotification('Test', 'error');
    }).not.toThrow();
  });
});
```

### C. Safe Execution Utilities (20 tests)

**File**: `tests/shared/safe-execute.test.ts`

#### 1. safeExecute (4 tests)

```typescript
describe('safeExecute', () => {
  test('should return result on success', async () => {
    const result = await safeExecute(async () => 'success');
    expect(result).toBe('success');
  });

  test('should return fallback on error', async () => {
    const result = await safeExecute(
      async () => { throw new Error('Failed'); },
      'fallback'
    );
    expect(result).toBe('fallback');
  });

  test('should call error handler on error', async () => {
    const errorHandler = jest.fn();
    await safeExecute(
      async () => { throw new Error('Test'); },
      null,
      errorHandler
    );
    expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
  });

  test('should use default error handler if none provided', async () => {
    const handleErrorSpy = jest.spyOn(ErrorHandler.getInstance(), 'handleError');
    await safeExecute(async () => { throw new Error('Test'); });
    expect(handleErrorSpy).toHaveBeenCalled();
  });
});
```

#### 2. safeExecuteSync (3 tests)

```typescript
describe('safeExecuteSync', () => {
  test('should return result on success', () => {
    const result = safeExecuteSync(() => 42);
    expect(result).toBe(42);
  });

  test('should return fallback on error', () => {
    const result = safeExecuteSync(
      () => { throw new Error('Failed'); },
      'fallback'
    );
    expect(result).toBe('fallback');
  });

  test('should call error handler', () => {
    const errorHandler = jest.fn();
    safeExecuteSync(
      () => { throw new Error('Test'); },
      null,
      errorHandler
    );
    expect(errorHandler).toHaveBeenCalled();
  });
});
```

#### 3. withErrorBoundary (3 tests)

```typescript
describe('withErrorBoundary', () => {
  test('should pass through successful execution', () => {
    const fn = () => 'success';
    const wrapped = withErrorBoundary(fn);
    expect(wrapped()).toBe('success');
  });

  test('should handle errors and rethrow', () => {
    const fn = () => { throw new Error('Test'); };
    const wrapped = withErrorBoundary(fn);
    expect(() => wrapped()).toThrow('Test');
  });

  test('should handle async functions', async () => {
    const fn = async () => { throw new Error('Async error'); };
    const wrapped = withErrorBoundary(fn);
    await expect(wrapped()).rejects.toThrow('Async error');
  });
});
```

#### 4. retryWithBackoff (5 tests)

```typescript
describe('retryWithBackoff', () => {
  test('should succeed on first attempt', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const result = await retryWithBackoff(fn, 3, 100);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('should retry on failure', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new GameNotFoundError('Game'))
      .mockResolvedValue('success');

    const result = await retryWithBackoff(fn, 3, 100);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('should throw after max retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Always fails'));

    await expect(retryWithBackoff(fn, 2, 100)).rejects.toThrow('Always fails');
    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  test('should not retry non-recoverable errors', async () => {
    const fn = jest.fn().mockRejectedValue(new DatabaseLoadError('Critical'));

    await expect(retryWithBackoff(fn, 3, 100)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1); // No retries
  });

  test('should use exponential backoff', async () => {
    jest.useFakeTimers();

    const fn = jest.fn()
      .mockRejectedValueOnce(new GameNotFoundError('Game'))
      .mockRejectedValueOnce(new GameNotFoundError('Game'))
      .mockResolvedValue('success');

    const promise = retryWithBackoff(fn, 3, 100);

    // First retry after 100ms
    await jest.advanceTimersByTimeAsync(100);
    // Second retry after 200ms
    await jest.advanceTimersByTimeAsync(200);

    const result = await promise;
    expect(result).toBe('success');

    jest.useRealTimers();
  });
});
```

#### 5. withTimeout (3 tests)

```typescript
describe('withTimeout', () => {
  test('should return result if completes in time', async () => {
    const fn = async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return 'success';
    };

    const result = await withTimeout(fn, 1000);
    expect(result).toBe('success');
  });

  test('should throw if exceeds timeout', async () => {
    const fn = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return 'success';
    };

    await expect(withTimeout(fn, 50)).rejects.toThrow('Operation timed out');
  });

  test('should use custom timeout message', async () => {
    const fn = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
    };

    await expect(
      withTimeout(fn, 50, 'Custom timeout')
    ).rejects.toThrow('Custom timeout');
  });
});
```

#### 6. batchExecute (2 tests)

```typescript
describe('batchExecute', () => {
  test('should execute all operations successfully', async () => {
    const ops = [
      async () => 'result1',
      async () => 'result2',
      async () => 'result3'
    ];

    const results = await batchExecute(ops);

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ success: true, data: 'result1' });
    expect(results[1]).toEqual({ success: true, data: 'result2' });
    expect(results[2]).toEqual({ success: true, data: 'result3' });
  });

  test('should continue on error by default', async () => {
    const ops = [
      async () => 'result1',
      async () => { throw new Error('Failed'); },
      async () => 'result3'
    ];

    const results = await batchExecute(ops);

    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[2].success).toBe(true);
  });
});
```

---

### D. Integration Tests (17 tests)

#### 1. Content Script Error Handling (8 tests)

**File**: `tests/integration/content-error-handling.test.ts`

```typescript
describe('Content Script - Error Handling Integration', () => {
  let contentScript: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup DOM for content script
    document.body.innerHTML = '<div class="game_area_purchase"></div>';
    // Import content script
    contentScript = require('../src/content/content-script-hybrid.ts');
  });

  test('should handle game detection failure gracefully', async () => {
    // Mock URL without game info
    Object.defineProperty(window, 'location', {
      value: { href: 'https://store.steampowered.com/' },
      writable: true
    });

    await contentScript.initialize();

    // Should not throw, should log detection error
    const errorLog = ErrorHandler.getInstance().getErrorLog();
    expect(errorLog.some(e => e.code === 'PAGE_DETECTION_ERROR')).toBe(true);
  });

  test('should handle background service timeout', async () => {
    chrome.runtime.sendMessage.mockImplementation(
      () => new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 100)
      )
    );

    await contentScript.initialize();

    // Should inject error message in UI
    expect(document.querySelector('.hltb-error')).toBeTruthy();
  });

  test('should handle DOM injection failure', async () => {
    // Remove injection point
    document.body.innerHTML = '';

    chrome.runtime.sendMessage.mockResolvedValue({
      success: true,
      data: { mainStory: 10 }
    });

    await contentScript.initialize();

    const errorLog = ErrorHandler.getInstance().getErrorLog();
    expect(errorLog.some(e => e.code === 'DOM_INJECTION_ERROR')).toBe(true);
  });

  test('should display error notification on failure', async () => {
    chrome.runtime.sendMessage.mockResolvedValue({
      success: false,
      error: 'Database load failed'
    });

    await contentScript.initialize();

    const errorElement = document.querySelector('.hltb-error');
    expect(errorElement).toBeTruthy();
    expect(errorElement?.textContent).toContain('Database load failed');
  });

  test('should recover from transient network errors', async () => {
    chrome.runtime.sendMessage
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue({ success: true, data: { mainStory: 10 } });

    // Content script should retry
    await contentScript.initialize();

    // Eventually succeeds
    expect(document.querySelector('.hltb-container')).toBeTruthy();
  });

  test('should handle corrupted response data', async () => {
    chrome.runtime.sendMessage.mockResolvedValue({
      success: true,
      data: { mainStory: 'invalid' } // Should be number
    });

    await contentScript.initialize();

    const errorLog = ErrorHandler.getInstance().getErrorLog();
    expect(errorLog.some(e => e.code === 'VALIDATION_ERROR')).toBe(true);
  });

  test('should cleanup on navigation errors', async () => {
    // Inject initial component
    await contentScript.initialize();
    expect(document.querySelector('.hltb-container')).toBeTruthy();

    // Navigate to invalid page
    Object.defineProperty(window, 'location', {
      value: { href: 'https://store.steampowered.com/invalid' },
      writable: true
    });

    // Trigger navigation observer
    await contentScript.handleNavigation();

    // Component should be removed
    expect(document.querySelector('.hltb-container')).toBeFalsy();
  });

  test('should log performance metrics even on error', async () => {
    const consoleSpy = jest.spyOn(console, 'log');

    chrome.runtime.sendMessage.mockRejectedValue(new Error('Fetch failed'));

    await contentScript.initialize();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Performance metrics'),
      expect.any(Object)
    );
  });
});
```

#### 2. Background Service Error Handling (6 tests)

**File**: `tests/integration/background-error-handling.test.ts`

```typescript
describe('Background Service - Error Handling Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should validate game title before processing', async () => {
    const invalidTitle = '<script>alert("xss")</script>';

    const response = await messageHandler.handle({
      action: 'fetchHLTB',
      gameTitle: invalidTitle,
      appId: '12345'
    }, {});

    expect(response.success).toBe(false);
    expect(response.error).toContain('Invalid');
  });

  test('should validate app ID format', async () => {
    const response = await messageHandler.handle({
      action: 'fetchHLTB',
      gameTitle: 'Valid Game',
      appId: 'not-numeric'
    }, {});

    expect(response.success).toBe(false);
    expect(response.error).toContain('Invalid app ID');
  });

  test('should handle database load failure gracefully', async () => {
    // Mock database import failure
    jest.mock('../src/background/services/fallback-data.json', () => {
      throw new Error('Failed to load database');
    });

    const response = await messageHandler.handle({
      action: 'fetchHLTB',
      gameTitle: 'Test Game',
      appId: '12345'
    }, {});

    expect(response.success).toBe(false);
    expect(response.error).toContain('database');
  });

  test('should return GameNotFoundError for missing games', async () => {
    const response = await messageHandler.handle({
      action: 'fetchHLTB',
      gameTitle: 'Nonexistent Game',
      appId: '99999'
    }, {});

    expect(response.success).toBe(false);
    expect(response.error).toContain('not found');

    // Should log missing game
    const errorLog = ErrorHandler.getInstance().getErrorLog();
    expect(errorLog.some(e => e.code === 'GAME_NOT_FOUND')).toBe(true);
  });

  test('should handle storage errors during cache operations', async () => {
    chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

    const response = await messageHandler.handle({
      action: 'fetchHLTB',
      gameTitle: 'Test Game',
      appId: '12345'
    }, {});

    // Should still return result without cache
    expect(response).toBeDefined();
  });

  test('should handle concurrent error scenarios', async () => {
    const requests = Array.from({ length: 5 }, (_, i) =>
      messageHandler.handle({
        action: 'fetchHLTB',
        gameTitle: `Game ${i}`,
        appId: `${i}`
      }, {})
    );

    // Some will fail, some succeed
    const results = await Promise.allSettled(requests);

    // All should resolve (not throw)
    expect(results.every(r => r.status === 'fulfilled')).toBe(true);
  });
});
```

#### 3. Message Passing Errors (3 tests)

**File**: `tests/integration/message-passing-errors.test.ts`

```typescript
describe('Message Passing - Error Scenarios', () => {
  test('should handle sendMessage rejection', async () => {
    chrome.runtime.sendMessage.mockRejectedValue(
      new Error('Extension context invalidated')
    );

    const result = await safeExecute(
      () => chrome.runtime.sendMessage({ action: 'test' }),
      { success: false, error: 'Communication failed' }
    );

    expect(result.success).toBe(false);
  });

  test('should timeout long-running background operations', async () => {
    chrome.runtime.sendMessage.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    await expect(
      withTimeout(
        () => chrome.runtime.sendMessage({ action: 'fetchHLTB' }),
        1000
      )
    ).rejects.toThrow('timed out');
  });

  test('should handle malformed responses', async () => {
    chrome.runtime.sendMessage.mockResolvedValue(null);

    const response = await safeExecute(
      () => chrome.runtime.sendMessage({ action: 'test' }),
      { success: false, error: 'No response' }
    );

    expect(response.success).toBe(false);
  });
});
```

---

### E. E2E Error Scenarios (9 tests)

#### 1. Error Recovery Flows (4 tests)

**File**: `tests/e2e/error-recovery.test.ts`

```typescript
describe('Error Recovery - E2E Flows', () => {
  test('should recover from cache corruption', async () => {
    // Set corrupted cache
    chrome.storage.local.get.mockResolvedValueOnce({
      match_cache: 'corrupted_data'
    });

    // Trigger cache read
    const handler = ErrorHandler.getInstance();
    handler.handleError(new StorageError('Cache corrupted', 'get'));

    // Wait for recovery
    await new Promise(resolve => setTimeout(resolve, 100));

    // Cache should be cleared
    expect(chrome.storage.local.remove).toHaveBeenCalledWith(['match_cache']);
  });

  test('should collect missing games for database expansion', async () => {
    chrome.storage.local.get.mockResolvedValue({ missing_games: [] });

    const errors = [
      new GameNotFoundError('Game A'),
      new GameNotFoundError('Game B'),
      new GameNotFoundError('Game C')
    ];

    const handler = ErrorHandler.getInstance();
    errors.forEach(e => handler.handleError(e));

    await new Promise(resolve => setTimeout(resolve, 100));

    // All games should be logged
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        missing_games: expect.arrayContaining(['Game A', 'Game B', 'Game C'])
      })
    );
  });

  test('should retry failed operations with backoff', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue('success');

    const result = await retryWithBackoff(operation, 3, 100);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  test('should gracefully degrade when background service unavailable', async () => {
    chrome.runtime.sendMessage.mockRejectedValue(
      new Error('Extension context invalidated')
    );

    // Content script should handle this
    const result = await safeExecute(
      () => chrome.runtime.sendMessage({ action: 'fetchHLTB' }),
      null
    );

    expect(result).toBeNull();

    // Error should be logged
    const errorLog = ErrorHandler.getInstance().getErrorLog();
    expect(errorLog.length).toBeGreaterThan(0);
  });
});
```

#### 2. User Notifications (3 tests)

**File**: `tests/e2e/user-notifications.test.ts`

```typescript
describe('User Notifications - Error Display', () => {
  test('should display error notification in content script', async () => {
    document.body.innerHTML = '<div class="game_area_purchase"></div>';

    // Simulate error from background
    chrome.runtime.sendMessage.mockResolvedValue({
      success: false,
      error: 'Database not available'
    });

    // Initialize content script
    await contentScript.initialize();

    // Error should be displayed
    const errorElement = document.querySelector('.hltb-error');
    expect(errorElement).toBeTruthy();
    expect(errorElement?.textContent).toContain('Database not available');
  });

  test('should show different notification types', async () => {
    chrome.tabs.query.mockResolvedValue([{ id: 123 }]);

    const handler = ErrorHandler.getInstance();

    // Send different notification types
    handler.showUserNotification('Error message', 'error');
    handler.showUserNotification('Warning message', 'warning');
    handler.showUserNotification('Info message', 'info');

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(3);
  });

  test('should auto-dismiss notifications', async () => {
    jest.useFakeTimers();

    document.body.innerHTML = '';

    // Show notification
    const notification = document.createElement('div');
    notification.className = 'hltb-notification';
    notification.textContent = 'Test notification';
    document.body.appendChild(notification);

    // Wait for auto-dismiss (3 seconds)
    jest.advanceTimersByTime(3000);

    // Notification should be removed
    expect(document.querySelector('.hltb-notification')).toBeFalsy();

    jest.useRealTimers();
  });
});
```

#### 3. Critical Error Handling (2 tests)

**File**: `tests/e2e/critical-errors.test.ts`

```typescript
describe('Critical Errors - System Behavior', () => {
  test('should halt extension on DatabaseLoadError', async () => {
    const error = new DatabaseLoadError('Critical: Database corrupted');

    const handler = ErrorHandler.getInstance({
      enableErrorReporting: true
    });

    handler.handleError(error);

    // Should mark as critical
    const stats = handler.getErrorStats();
    expect(stats.critical).toBeGreaterThan(0);

    // Should not attempt recovery
    expect(chrome.storage.local.remove).not.toHaveBeenCalled();
  });

  test('should report critical errors in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const consoleSpy = jest.spyOn(console, 'log');

    const handler = ErrorHandler.getInstance({
      enableErrorReporting: true
    });

    handler.handleError(new ValidationError('Data corrupted'));

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Would report critical error'),
      expect.any(Object)
    );

    process.env.NODE_ENV = originalEnv;
  });
});
```

---

## Coverage Targets

### Overall Coverage Goals

| Metric | Target | Critical Path |
|--------|--------|---------------|
| **Line Coverage** | 90% | 100% |
| **Branch Coverage** | 85% | 100% |
| **Function Coverage** | 95% | 100% |
| **Statement Coverage** | 90% | 100% |

### Component-Specific Targets

| Component | Line Coverage | Branch Coverage | Priority |
|-----------|--------------|-----------------|----------|
| **errors.ts** | 100% | 100% | High |
| **error-handler.ts** | 95% | 90% | High |
| **safe-execute.ts** | 95% | 90% | High |
| **content-script-hybrid.ts** (error paths) | 85% | 80% | Medium |
| **service-worker.ts** (error paths) | 85% | 80% | Medium |
| **message-handler.ts** (validation) | 90% | 85% | High |

### Critical Paths (100% Coverage Required)

1. Custom error class constructors
2. Error type guards (isHLTBError, isRecoverableError)
3. ErrorHandler.handleError main flow
4. Recovery mechanisms for each error type
5. Safe execution wrappers (safeExecute, safeExecuteSync)
6. Retry logic with exponential backoff
7. Message validation in background service

---

## CI/CD Integration

### Test Execution Strategy

#### 1. Pre-Commit Hook

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run test:errors && npm run lint"
    }
  }
}
```

**Script**:
```bash
# Run only error handling tests (fast)
npm run test:errors
```

```json
// package.json scripts
{
  "test:errors": "jest tests/shared tests/integration/.*error.* --coverage",
  "test:errors:watch": "jest tests/shared --watch",
  "test:unit": "jest tests/shared",
  "test:integration": "jest tests/integration",
  "test:e2e": "jest tests/e2e"
}
```

#### 2. Pull Request Checks

**GitHub Actions Workflow** (`.github/workflows/test-error-handling.yml`):

```yaml
name: Error Handling Tests

on:
  pull_request:
    paths:
      - 'src/shared/**'
      - 'src/content/**'
      - 'src/background/**'
      - 'tests/**'

jobs:
  test-error-handling:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run error handling unit tests
        run: npm run test:unit -- --coverage

      - name: Run integration tests
        run: npm run test:integration -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: error-handling

      - name: Check coverage thresholds
        run: |
          npm run test -- --coverage --coverageThreshold='{
            "global": {
              "lines": 90,
              "branches": 85,
              "functions": 95,
              "statements": 90
            }
          }'
```

#### 3. Quality Gates

```json
// jest.config.ts - Add coverage thresholds
{
  "coverageThreshold": {
    "global": {
      "lines": 90,
      "branches": 85,
      "functions": 95,
      "statements": 90
    },
    "src/shared/errors.ts": {
      "lines": 100,
      "branches": 100,
      "functions": 100,
      "statements": 100
    },
    "src/shared/error-handler.ts": {
      "lines": 95,
      "branches": 90,
      "functions": 95,
      "statements": 95
    }
  }
}
```

#### 4. Test Execution Order

**Parallel Execution** (fast feedback):
```bash
# Run all error tests in parallel
jest tests/shared tests/integration tests/e2e --maxWorkers=4
```

**Sequential for Debugging**:
```bash
# Run in order: unit → integration → e2e
npm run test:unit && npm run test:integration && npm run test:e2e
```

#### 5. Test Failure Handling

**Retry Policy**:
- Flaky tests: Retry up to 2 times
- E2E tests: Retry on timeout only
- Unit tests: No retries (should be deterministic)

```json
// jest.config.ts
{
  "testRetries": {
    "e2e": 2,
    "integration": 1,
    "unit": 0
  }
}
```

---

## Example Test Implementations

### Complete Test File Example: errors.test.ts

```typescript
/**
 * Unit Tests for Custom Error Classes
 *
 * Tests all custom error classes, type guards, and utility functions
 */

import {
  HLTBError,
  DatabaseLoadError,
  GameNotFoundError,
  LowConfidenceMatchError,
  SteamPageDetectionError,
  DOMInjectionError,
  StorageError,
  ValidationError,
  isHLTBError,
  isRecoverableError,
  getUserMessage,
  getErrorCode
} from '../../src/shared/errors';

describe('Custom Error Classes', () => {
  describe('HLTBError Base Class', () => {
    test('should create error with all properties', () => {
      const error = new HLTBError(
        'Test error message',
        'TEST_CODE',
        true,
        'User-friendly message'
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(HLTBError);
      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.recoverable).toBe(true);
      expect(error.userMessage).toBe('User-friendly message');
      expect(error.name).toBe('HLTBError');
      expect(error.stack).toBeDefined();
    });

    test('should default recoverable to true', () => {
      const error = new HLTBError('Test', 'CODE');
      expect(error.recoverable).toBe(true);
    });

    test('should allow userMessage to be undefined', () => {
      const error = new HLTBError('Test', 'CODE', false);
      expect(error.userMessage).toBeUndefined();
    });

    test('should maintain proper stack trace', () => {
      const error = new HLTBError('Test', 'CODE');
      expect(error.stack).toContain('HLTBError');
      expect(error.stack).toContain('errors.test.ts');
    });
  });

  describe('DatabaseLoadError', () => {
    test('should create non-recoverable error', () => {
      const error = new DatabaseLoadError('DB failed');

      expect(error).toBeInstanceOf(DatabaseLoadError);
      expect(error).toBeInstanceOf(HLTBError);
      expect(error.code).toBe('DATABASE_LOAD_ERROR');
      expect(error.recoverable).toBe(false);
      expect(error.name).toBe('DatabaseLoadError');
    });

    test('should store original error', () => {
      const originalError = new Error('File not found');
      const error = new DatabaseLoadError('DB failed', originalError);

      expect(error.originalError).toBe(originalError);
    });

    test('should have user-friendly message', () => {
      const error = new DatabaseLoadError('DB failed');
      expect(error.userMessage).toContain('Failed to load HLTB database');
    });
  });

  describe('GameNotFoundError', () => {
    test('should include game title', () => {
      const error = new GameNotFoundError('Cyberpunk 2077');

      expect(error.gameTitle).toBe('Cyberpunk 2077');
      expect(error.message).toContain('Cyberpunk 2077');
      expect(error.code).toBe('GAME_NOT_FOUND');
      expect(error.recoverable).toBe(true);
    });

    test('should have user-friendly message with game title', () => {
      const error = new GameNotFoundError('Test Game');
      expect(error.userMessage).toContain('No completion time data available');
      expect(error.userMessage).toContain('Test Game');
    });
  });

  describe('LowConfidenceMatchError', () => {
    test('should include game title and confidence', () => {
      const error = new LowConfidenceMatchError('Test Game', 45);

      expect(error.gameTitle).toBe('Test Game');
      expect(error.confidence).toBe(45);
      expect(error.message).toContain('Test Game');
      expect(error.message).toContain('45%');
      expect(error.code).toBe('LOW_CONFIDENCE');
    });

    test('should format confidence in user message', () => {
      const error = new LowConfidenceMatchError('Game', 60);
      expect(error.userMessage).toContain('60%');
      expect(error.userMessage).toContain('confidence is low');
    });
  });

  describe('SteamPageDetectionError', () => {
    test('should be recoverable by default', () => {
      const error = new SteamPageDetectionError('Detection failed');
      expect(error.recoverable).toBe(true);
      expect(error.code).toBe('PAGE_DETECTION_ERROR');
    });

    test('should include detection attempts', () => {
      const error = new SteamPageDetectionError('Failed', 3);
      expect(error.detectionAttempts).toBe(3);
    });

    test('should work without detection attempts', () => {
      const error = new SteamPageDetectionError('Failed');
      expect(error.detectionAttempts).toBeUndefined();
    });
  });

  describe('DOMInjectionError', () => {
    test('should include attempted selectors', () => {
      const selectors = ['.selector1', '.selector2', '#selector3'];
      const error = new DOMInjectionError('Injection failed', selectors);

      expect(error.attemptedSelectors).toEqual(selectors);
      expect(error.code).toBe('DOM_INJECTION_ERROR');
      expect(error.recoverable).toBe(true);
    });

    test('should work without selectors', () => {
      const error = new DOMInjectionError('Injection failed');
      expect(error.attemptedSelectors).toBeUndefined();
    });
  });

  describe('StorageError', () => {
    test('should include operation type', () => {
      const error = new StorageError('Storage failed', 'get');

      expect(error.operation).toBe('get');
      expect(error.code).toBe('STORAGE_ERROR');
      expect(error.recoverable).toBe(true);
    });

    test('should work with different operations', () => {
      const operations: Array<'get' | 'set' | 'remove' | 'clear'> =
        ['get', 'set', 'remove', 'clear'];

      operations.forEach(op => {
        const error = new StorageError('Failed', op);
        expect(error.operation).toBe(op);
      });
    });
  });

  describe('ValidationError', () => {
    test('should be non-recoverable', () => {
      const error = new ValidationError('Invalid data');
      expect(error.recoverable).toBe(false);
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    test('should include field and value', () => {
      const error = new ValidationError('Invalid', 'appId', 'abc123');

      expect(error.field).toBe('appId');
      expect(error.value).toBe('abc123');
    });
  });

  describe('Type Guards and Utilities', () => {
    test('isHLTBError should identify HLTB errors', () => {
      const hltbError = new GameNotFoundError('Test');
      const normalError = new Error('Normal error');

      expect(isHLTBError(hltbError)).toBe(true);
      expect(isHLTBError(normalError)).toBe(false);
      expect(isHLTBError('not an error')).toBe(false);
      expect(isHLTBError(null)).toBe(false);
    });

    test('isRecoverableError should check recoverable flag', () => {
      const recoverableError = new GameNotFoundError('Test');
      const nonRecoverableError = new DatabaseLoadError('Test');
      const normalError = new Error('Normal');

      expect(isRecoverableError(recoverableError)).toBe(true);
      expect(isRecoverableError(nonRecoverableError)).toBe(false);
      expect(isRecoverableError(normalError)).toBe(false);
    });

    test('getUserMessage should return appropriate message', () => {
      const hltbError = new GameNotFoundError('Test Game');
      const normalError = new Error('Normal error');
      const notAnError = 'string error';

      expect(getUserMessage(hltbError)).toContain('No completion time data');
      expect(getUserMessage(normalError)).toBe('Normal error');
      expect(getUserMessage(notAnError)).toBe('An unexpected error occurred');
    });

    test('getErrorCode should return appropriate code', () => {
      const hltbError = new GameNotFoundError('Test');
      const normalError = new Error('Normal');
      const notAnError = 'string';

      expect(getErrorCode(hltbError)).toBe('GAME_NOT_FOUND');
      expect(getErrorCode(normalError)).toBe('Error');
      expect(getErrorCode(notAnError)).toBe('UNKNOWN_ERROR');
    });
  });
});
```

### Integration Test Example: content-error-handling.test.ts

```typescript
/**
 * Integration Tests for Content Script Error Handling
 *
 * Tests error flows in content script including:
 * - Game detection failures
 * - Background communication errors
 * - DOM injection failures
 * - Error recovery mechanisms
 */

import { ErrorHandler } from '../../src/shared/error-handler';

describe('Content Script - Error Handling Integration', () => {
  let contentScript: any;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    // Reset singleton
    (ErrorHandler as any).instance = null;

    // Clear all mocks
    jest.clearAllMocks();
    global.resetChromeMocks();

    // Setup basic DOM
    document.body.innerHTML = '<div class="game_area_purchase"></div>';

    // Setup window location
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://store.steampowered.com/app/12345/Test_Game/'
      },
      writable: true,
      configurable: true
    });

    // Get error handler instance
    errorHandler = ErrorHandler.getInstance({
      enableConsoleLogging: false,
      enableStoragePersistence: false
    });

    // Import content script (adjust path as needed)
    contentScript = require('../../src/content/content-script-hybrid.ts');
  });

  afterEach(() => {
    // Cleanup
    document.body.innerHTML = '';
    if (contentScript.destroy) {
      contentScript.destroy();
    }
  });

  describe('Game Detection Errors', () => {
    test('should handle missing app ID gracefully', async () => {
      // URL without app ID
      Object.defineProperty(window, 'location', {
        value: { href: 'https://store.steampowered.com/browse/' },
        writable: true,
        configurable: true
      });

      await contentScript.initialize();

      // Should log page detection error
      const errorLog = errorHandler.getErrorLog();
      const detectionError = errorLog.find(e =>
        e.code === 'PAGE_DETECTION_ERROR'
      );

      expect(detectionError).toBeDefined();
      expect(detectionError?.recoverable).toBe(true);
    });

    test('should handle missing game title', async () => {
      // Remove all title elements
      document.title = '';
      const metaTags = document.querySelectorAll('meta[property="og:title"]');
      metaTags.forEach(tag => tag.remove());

      await contentScript.initialize();

      const errorLog = errorHandler.getErrorLog();
      expect(errorLog.some(e =>
        e.code === 'PAGE_DETECTION_ERROR'
      )).toBe(true);
    });
  });

  describe('Background Communication Errors', () => {
    test('should handle sendMessage timeout', async () => {
      // Mock timeout
      chrome.runtime.sendMessage.mockImplementation(
        () => new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      await contentScript.initialize();

      // Should display error in UI
      const errorElement = document.querySelector('.hltb-error');
      expect(errorElement).toBeTruthy();
    });

    test('should handle extension context invalidated', async () => {
      chrome.runtime.sendMessage.mockRejectedValue(
        new Error('Extension context invalidated')
      );

      await contentScript.initialize();

      const errorLog = errorHandler.getErrorLog();
      expect(errorLog.length).toBeGreaterThan(0);
    });

    test('should handle malformed background response', async () => {
      chrome.runtime.sendMessage.mockResolvedValue(null);

      await contentScript.initialize();

      const errorElement = document.querySelector('.hltb-error');
      expect(errorElement).toBeTruthy();
    });
  });

  describe('DOM Injection Errors', () => {
    test('should handle missing injection point', async () => {
      // Remove all potential injection points
      document.body.innerHTML = '';

      chrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: { mainStory: 10, mainExtra: 20, completionist: 30 }
      });

      await contentScript.initialize();

      const errorLog = errorHandler.getErrorLog();
      const injectionError = errorLog.find(e =>
        e.code === 'DOM_INJECTION_ERROR'
      );

      expect(injectionError).toBeDefined();
    });

    test('should try multiple injection points', async () => {
      // Remove primary injection point, keep fallback
      document.body.innerHTML = '<div class="rightcol"></div>';

      chrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: { mainStory: 10 }
      });

      await contentScript.initialize();

      // Should successfully inject at fallback location
      const container = document.querySelector('.hltb-container');
      expect(container).toBeTruthy();
    });
  });

  describe('Error Recovery', () => {
    test('should retry on transient failure', async () => {
      chrome.runtime.sendMessage
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({
          success: true,
          data: { mainStory: 10 }
        });

      await contentScript.initialize();

      // Should eventually succeed
      const container = document.querySelector('.hltb-container');
      expect(container).toBeTruthy();
    });

    test('should cleanup and reinject on navigation', async () => {
      // Initial injection
      chrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: { mainStory: 10 }
      });

      await contentScript.initialize();
      expect(document.querySelector('.hltb-container')).toBeTruthy();

      // Navigate to new game
      Object.defineProperty(window, 'location', {
        value: { href: 'https://store.steampowered.com/app/67890/New_Game/' },
        writable: true,
        configurable: true
      });

      // Trigger navigation handler
      if (contentScript.handleNavigation) {
        await contentScript.handleNavigation();
      }

      // Old container should be removed, new one injected
      const containers = document.querySelectorAll('.hltb-container');
      expect(containers.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Error Display', () => {
    test('should display user-friendly error messages', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        success: false,
        error: 'Database not available'
      });

      await contentScript.initialize();

      const errorElement = document.querySelector('.hltb-error');
      expect(errorElement?.textContent).toContain('Database not available');
    });

    test('should not display technical error details to user', async () => {
      chrome.runtime.sendMessage.mockRejectedValue(
        new Error('TypeError: Cannot read property "x" of undefined')
      );

      await contentScript.initialize();

      const errorElement = document.querySelector('.hltb-error');
      // Should show generic message, not stack trace
      expect(errorElement?.textContent).not.toContain('TypeError');
      expect(errorElement?.textContent).not.toContain('undefined');
    });
  });
});
```

---

## Maintenance Guidelines

### 1. Test Organization Principles

- **One test file per source file**: Each source file should have a corresponding test file
- **Descriptive test names**: Use "should... when..." pattern
- **Test independence**: Each test should be runnable in isolation
- **Clear setup/teardown**: Use beforeEach/afterEach consistently
- **Avoid test interdependence**: Don't rely on test execution order

### 2. Mock Management

**Keep mocks in sync with APIs**:
```typescript
// When Chrome API changes, update mock in tests/setup.js
// Document mock assumptions

// Example: Mock matches real Chrome API signature
chrome.storage.local.get(keys: string | string[] | object): Promise<{[key: string]: any}>
```

**Centralize mock data**:
```typescript
// tests/mocks/test-data.ts
export const STANDARD_TEST_CASES = {
  validGame: { appId: '12345', title: 'Test Game' },
  invalidAppId: { appId: 'abc', title: 'Invalid' },
  missingGame: { appId: '99999', title: 'Not Found' }
};
```

### 3. Test Data Factories

```typescript
// tests/shared/test-helpers.ts
export function createMockHLTBError(
  overrides: Partial<HLTBError> = {}
): HLTBError {
  return {
    message: 'Test error',
    code: 'TEST_ERROR',
    recoverable: true,
    userMessage: 'User message',
    name: 'HLTBError',
    stack: 'Error stack',
    ...overrides
  } as HLTBError;
}

export function createMockErrorLog(
  count: number = 5
): ErrorLogEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: Date.now() - (i * 1000),
    message: `Error ${i}`,
    code: 'TEST_ERROR',
    name: 'Error',
    recoverable: true,
    context: {}
  }));
}
```

### 4. Handling Async Tests

**Use async/await consistently**:
```typescript
// Good
test('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe('success');
});

// Avoid (callback hell)
test('should handle async operation', (done) => {
  asyncFunction().then(result => {
    expect(result).toBe('success');
    done();
  });
});
```

**Wait for async side effects**:
```typescript
test('should update storage', async () => {
  handler.handleError(new Error('Test'));

  // Wait for async storage operation
  await new Promise(resolve => setTimeout(resolve, 50));

  expect(chrome.storage.local.set).toHaveBeenCalled();
});
```

### 5. Test Maintenance Checklist

When updating error handling code:

- [ ] Update corresponding unit tests
- [ ] Add integration tests if behavior changes
- [ ] Update mock if Chrome API changes
- [ ] Check coverage doesn't drop below threshold
- [ ] Update test data fixtures if needed
- [ ] Run full test suite before committing
- [ ] Update this document if strategy changes

### 6. Debugging Test Failures

**Enable verbose logging**:
```bash
# Run with verbose output
npm test -- --verbose

# Run single test file
npm test -- tests/shared/errors.test.ts

# Run with coverage
npm test -- --coverage --verbose
```

**Use focused tests during development**:
```typescript
// Temporarily focus on one test
test.only('should handle specific case', () => {
  // Test code
});

// Skip flaky test temporarily
test.skip('flaky test to fix later', () => {
  // Test code
});
```

**Check mock state**:
```typescript
test('debugging mock calls', () => {
  // See all calls to mock
  console.log(chrome.storage.local.set.mock.calls);

  // See call arguments
  console.log(chrome.storage.local.set.mock.calls[0][0]);

  // Check call count
  expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
});
```

### 7. Continuous Improvement

**Review test metrics monthly**:
- Identify slow tests (> 1s each)
- Find flaky tests (fail randomly)
- Check coverage trends
- Update mock strategies

**Refactor tests when**:
- Tests become hard to understand
- Setup/teardown is duplicated
- Mock management is complex
- Test execution is slow

### 8. Documentation

**Document complex test scenarios**:
```typescript
describe('Complex Error Recovery Flow', () => {
  // Scenario: User navigates between games while background service
  // is temporarily unavailable. Extension should:
  // 1. Queue requests
  // 2. Retry with backoff
  // 3. Eventually succeed when service returns
  // 4. Display correct data for each game

  test('should handle service unavailability during navigation', async () => {
    // Test implementation
  });
});
```

---

## Summary

This comprehensive test strategy provides:

1. **85-95 tests** covering all error handling scenarios
2. **70/20/10 test pyramid** distribution for optimal coverage
3. **Organized test files** by component and test type
4. **Mock strategies** for Chrome APIs and error scenarios
5. **Specific test cases** for each error class and handler method
6. **Coverage targets** with quality gates (90%+ overall)
7. **CI/CD integration** with automated testing and reporting
8. **Example implementations** showing patterns and best practices
9. **Maintenance guidelines** for long-term test health

### Next Steps

1. **Create test directory structure**
2. **Implement unit tests** (errors.ts, error-handler.ts, safe-execute.ts)
3. **Add integration tests** (content script, background service)
4. **Setup CI/CD workflow** with coverage reporting
5. **Document any deviations** from this strategy
6. **Run tests regularly** during development

### Success Criteria

- [ ] All 85-95 tests implemented and passing
- [ ] 90%+ code coverage for error handling system
- [ ] 100% coverage for critical error paths
- [ ] CI/CD pipeline green with quality gates
- [ ] Zero flaky tests
- [ ] Test execution time < 30 seconds

---

**End of Error Handling Test Strategy**
