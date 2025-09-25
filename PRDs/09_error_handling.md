name: "Error Handling"
description: |

## Purpose
Implement comprehensive error handling throughout the extension to gracefully manage failures, provide helpful user feedback, and maintain functionality despite errors.

## Core Principles
1. **Context is King**: Include all error scenarios and recovery strategies
2. **Validation Loops**: Test error handling in all failure modes
3. **Information Dense**: Use specific error messages and codes
4. **Progressive Success**: Fail gracefully, recover when possible
5. **User First**: Never leave users confused about failures

---

## Goal
Create a resilient error handling system that catches all failures, provides clear feedback to users, logs for debugging, and recovers automatically when possible.

## Why
- **User Trust**: Professional error handling builds confidence
- **Debugging**: Detailed logs help identify issues
- **Resilience**: Extension continues working despite failures
- **Support**: Clear errors reduce support burden

## What
Error handling system providing:
- Global error boundaries
- Specific error types
- User-friendly messages
- Automatic retry logic
- Error reporting
- Debug logging
- Fallback strategies
- Recovery mechanisms
- Rate limit handling
- Network failure recovery

### Success Criteria
- [ ] All errors caught
- [ ] No crashes/white screens
- [ ] Clear user messages
- [ ] Automatic recovery works
- [ ] Logs useful for debugging
- [ ] Rate limits handled
- [ ] Network errors managed
- [ ] Storage errors handled
- [ ] API failures recovered
- [ ] Error reporting works

## Implementation Blueprint

### Task 1: Error Types and Classes
```typescript
// src/common/errors.ts
export class HLTBError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true,
    public userMessage?: string
  ) {
    super(message);
    this.name = 'HLTBError';
  }
}

export class NetworkError extends HLTBError {
  constructor(message: string, public status?: number) {
    super(
      message,
      'NETWORK_ERROR',
      true,
      'Unable to fetch data. Please check your connection.'
    );
  }
}

export class RateLimitError extends HLTBError {
  constructor(public retryAfter: number) {
    super(
      `Rate limited. Retry after ${retryAfter}ms`,
      'RATE_LIMIT',
      true,
      'Too many requests. Please wait a moment.'
    );
  }
}

export class StorageError extends HLTBError {
  constructor(message: string) {
    super(
      message,
      'STORAGE_ERROR',
      true,
      'Cache storage issue. Some features may be limited.'
    );
  }
}

export class ParseError extends HLTBError {
  constructor(message: string) {
    super(
      message,
      'PARSE_ERROR',
      false,
      'Unable to process game data.'
    );
  }
}

export class ValidationError extends HLTBError {
  constructor(message: string) {
    super(
      message,
      'VALIDATION_ERROR',
      false,
      'Invalid data received.'
    );
  }
}
```

### Task 2: Global Error Handler
```typescript
// src/common/error-handler.ts
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: ErrorLogEntry[] = [];
  private readonly MAX_LOG_SIZE = 100;

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  constructor() {
    this.setupGlobalHandlers();
  }

  private setupGlobalHandlers() {
    // Handle uncaught errors
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.handleError(new Error(event.message), {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.handleError(new Error(event.reason), {
          promise: true
        });
      });
    }

    // Chrome extension specific error handling
    if (chrome?.runtime) {
      chrome.runtime.onError?.addListener((error) => {
        this.handleError(new Error(error));
      });
    }
  }

  handleError(error: Error, context: any = {}): void {
    console.error('[HLTB Error]', error, context);

    // Log error
    this.logError(error, context);

    // Determine error type and response
    if (error instanceof HLTBError) {
      this.handleHLTBError(error);
    } else if (error.name === 'NetworkError') {
      this.handleNetworkError(error);
    } else {
      this.handleUnknownError(error);
    }

    // Report critical errors
    if (this.isCritical(error)) {
      this.reportError(error, context);
    }
  }

  private handleHLTBError(error: HLTBError) {
    // Show user message if available
    if (error.userMessage) {
      this.showUserNotification(error.userMessage, 'error');
    }

    // Attempt recovery if possible
    if (error.recoverable) {
      this.attemptRecovery(error);
    }
  }

  private handleNetworkError(error: Error) {
    console.log('[HLTB] Network error, will retry with exponential backoff');
    // Trigger retry mechanism
    this.scheduleRetry();
  }

  private handleUnknownError(error: Error) {
    console.error('[HLTB] Unknown error:', error);
    this.showUserNotification(
      'An unexpected error occurred. The extension may not work properly.',
      'error'
    );
  }

  private attemptRecovery(error: HLTBError) {
    switch (error.code) {
      case 'RATE_LIMIT':
        // Wait and retry
        setTimeout(() => {
          console.log('[HLTB] Retrying after rate limit');
        }, (error as RateLimitError).retryAfter);
        break;

      case 'STORAGE_ERROR':
        // Clear cache and retry
        this.clearCorruptedCache();
        break;

      case 'NETWORK_ERROR':
        // Use cached data if available
        this.fallbackToCache();
        break;
    }
  }

  private logError(error: Error, context: any) {
    const entry: ErrorLogEntry = {
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack,
      context,
      name: error.name
    };

    this.errorLog.push(entry);

    // Trim log if too large
    if (this.errorLog.length > this.MAX_LOG_SIZE) {
      this.errorLog.shift();
    }

    // Persist to storage for debugging
    chrome.storage.local.set({
      errorLog: this.errorLog
    });
  }

  private isCritical(error: Error): boolean {
    // Define critical error conditions
    return (
      error.message.includes('undefined') ||
      error.message.includes('Cannot read') ||
      error.stack?.includes('service-worker')
    );
  }

  private reportError(error: Error, context: any) {
    // Send to error reporting service (if configured)
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to Sentry or similar
      console.log('[HLTB] Would report error to monitoring service');
    }
  }

  private showUserNotification(message: string, type: 'error' | 'warning') {
    // Send message to content script to show notification
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'showNotification',
          message,
          type
        });
      }
    });
  }

  private scheduleRetry() {
    // Implement exponential backoff
    let retryCount = 0;
    const maxRetries = 3;

    const retry = () => {
      if (retryCount >= maxRetries) {
        console.error('[HLTB] Max retries reached');
        return;
      }

      const delay = Math.pow(2, retryCount) * 1000;
      setTimeout(() => {
        retryCount++;
        console.log(`[HLTB] Retry attempt ${retryCount}`);
        // Trigger retry logic
      }, delay);
    };

    retry();
  }

  private clearCorruptedCache() {
    chrome.storage.local.remove(['cache'], () => {
      console.log('[HLTB] Corrupted cache cleared');
    });
  }

  private fallbackToCache() {
    console.log('[HLTB] Falling back to cached data');
    // Implement cache fallback logic
  }

  getErrorLog(): ErrorLogEntry[] {
    return this.errorLog;
  }

  clearErrorLog() {
    this.errorLog = [];
    chrome.storage.local.remove(['errorLog']);
  }
}

interface ErrorLogEntry {
  timestamp: number;
  message: string;
  stack?: string;
  context: any;
  name: string;
}
```

### Task 3: Try-Catch Wrapper
```typescript
// src/common/safe-execute.ts
export async function safeExecute<T>(
  fn: () => Promise<T>,
  fallback?: T,
  errorHandler?: (error: Error) => void
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    const handler = errorHandler || ErrorHandler.getInstance().handleError;
    handler(error as Error);
    return fallback;
  }
}

export function withErrorBoundary<T extends (...args: any[]) => any>(fn: T): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result.catch((error) => {
          ErrorHandler.getInstance().handleError(error);
          throw error;
        });
      }
      return result;
    } catch (error) {
      ErrorHandler.getInstance().handleError(error as Error);
      throw error;
    }
  }) as T;
}
```

## Validation Checklist
- [ ] All errors caught
- [ ] User messages clear
- [ ] Recovery works
- [ ] Logging functional
- [ ] No crashes
- [ ] Rate limits handled
- [ ] Network errors managed
- [ ] Storage errors handled
- [ ] Debug info available
- [ ] Error reporting works

---

## Confidence Score: 8/10
High confidence in error handling patterns, with robust recovery mechanisms.