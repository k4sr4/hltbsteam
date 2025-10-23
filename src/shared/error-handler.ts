/**
 * Global Error Handler for HLTB Steam Extension
 *
 * Centralized error handling, logging, and recovery mechanisms.
 * Implements singleton pattern for global access.
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
  getUserMessage,
  getErrorCode
} from './errors';

/**
 * Error log entry structure
 */
export interface ErrorLogEntry {
  timestamp: number;
  message: string;
  stack?: string;
  context: any;
  name: string;
  code: string;
  recoverable: boolean;
  userMessage?: string;
}

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  /** Maximum number of errors to keep in log */
  maxLogSize?: number;

  /** Enable console logging */
  enableConsoleLogging?: boolean;

  /** Enable storage persistence */
  enableStoragePersistence?: boolean;

  /** Enable error reporting in production */
  enableErrorReporting?: boolean;
}

/**
 * Global error handler singleton
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: ErrorLogEntry[] = [];
  private readonly MAX_LOG_SIZE: number;
  private readonly config: Required<ErrorHandlerConfig>;

  /**
   * Get singleton instance
   */
  static getInstance(config?: ErrorHandlerConfig): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler(config);
    }
    return ErrorHandler.instance;
  }

  /**
   * Private constructor for singleton pattern
   */
  private constructor(config?: ErrorHandlerConfig) {
    this.config = {
      maxLogSize: config?.maxLogSize ?? 100,
      enableConsoleLogging: config?.enableConsoleLogging ?? true,
      enableStoragePersistence: config?.enableStoragePersistence ?? true,
      enableErrorReporting: config?.enableErrorReporting ?? false
    };

    this.MAX_LOG_SIZE = this.config.maxLogSize;
    this.setupGlobalHandlers();
  }

  /**
   * Setup global error handlers for uncaught errors
   */
  private setupGlobalHandlers(): void {
    // Only set up in browser context
    if (typeof window !== 'undefined') {
      // Handle uncaught errors
      window.addEventListener('error', (event) => {
        this.handleError(new Error(event.message), {
          type: 'uncaught',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      });

      // Handle unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        const error = event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason));

        this.handleError(error, {
          type: 'unhandled_promise',
          promise: true
        });
      });
    }

    // Chrome extension specific error handling
    if (typeof chrome !== 'undefined' && chrome?.runtime) {
      // Handle Chrome runtime errors
      chrome.runtime.onError?.addListener((error) => {
        this.handleError(new Error(String(error)), {
          type: 'chrome_runtime'
        });
      });
    }
  }

  /**
   * Main error handling method
   */
  handleError(error: Error, context: any = {}): void {
    // Console logging
    if (this.config.enableConsoleLogging) {
      console.error('[HLTB Error]', error, context);
    }

    // Log error for debugging
    this.logError(error, context);

    // Determine error type and response
    if (isHLTBError(error)) {
      this.handleHLTBError(error);
    } else if (error.name === 'NetworkError') {
      this.handleNetworkError(error);
    } else {
      this.handleUnknownError(error);
    }

    // Report critical errors in production
    if (this.isCritical(error) && this.config.enableErrorReporting) {
      this.reportError(error, context);
    }
  }

  /**
   * Handle HLTB-specific errors
   */
  private handleHLTBError(error: HLTBError): void {
    // Attempt recovery if possible
    if (error.recoverable) {
      this.attemptRecovery(error);
    }
  }

  /**
   * Handle network errors
   */
  private handleNetworkError(error: Error): void {
    console.error('[HLTB] Network error - data may be unavailable');
  }

  /**
   * Handle unknown errors
   */
  private handleUnknownError(error: Error): void {
    console.error('[HLTB] Unknown error:', error);
  }

  /**
   * Attempt automatic recovery based on error type
   */
  private attemptRecovery(error: HLTBError): void {
    switch (error.code) {
      case 'GAME_NOT_FOUND':
        // Log missing game for database expansion
        const gameNotFoundError = error as GameNotFoundError;
        this.logMissingGame(gameNotFoundError.gameTitle);
        break;

      case 'PAGE_DETECTION_ERROR':
        // Log detection failure for improvement
        console.log('[HLTB] Page detection failed - trying fallback strategies');
        break;

      case 'DOM_INJECTION_ERROR':
        // Log injection failure for debugging
        console.log('[HLTB] DOM injection failed - checking alternative injection points');
        break;

      case 'STORAGE_ERROR':
        // Clear corrupted cache as recovery
        const storageError = error as StorageError;
        if (storageError.operation === 'get' || storageError.operation === 'set') {
          this.clearCorruptedCache();
        }
        break;

      case 'LOW_CONFIDENCE':
        // Log low confidence match for review
        const lcError = error as LowConfidenceMatchError;
        console.warn(`[HLTB] Low confidence match: ${lcError.gameTitle} (${lcError.confidence}%)`);
        break;

      case 'DATABASE_LOAD_ERROR':
        // Critical - cannot recover, user needs to reinstall
        console.error('[HLTB] Critical database error - extension cannot function');
        break;
    }
  }

  /**
   * Log missing game for future database expansion
   */
  private logMissingGame(gameTitle: string): void {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      return;
    }

    chrome.storage.local.get('missing_games', (result) => {
      const missingGames: string[] = result.missing_games || [];

      // Add if not already logged
      if (!missingGames.includes(gameTitle)) {
        missingGames.push(gameTitle);

        // Keep only last 100 missing games
        const trimmedGames = missingGames.slice(-100);

        chrome.storage.local.set({ missing_games: trimmedGames }, () => {
          console.log(`[HLTB] Logged missing game: ${gameTitle}`);
        });
      }
    });
  }

  /**
   * Clear corrupted cache
   */
  private clearCorruptedCache(): void {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      return;
    }

    chrome.storage.local.remove(['match_cache'], () => {
      console.log('[HLTB] Corrupted cache cleared');
    });
  }

  /**
   * Log error to internal log
   */
  private logError(error: Error, context: any): void {
    const entry: ErrorLogEntry = {
      timestamp: Date.now(),
      message: error.message,
      // Only store stack traces in development
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      // Sanitize context before storage
      context: this.sanitizeContext(context),
      name: error.name,
      code: getErrorCode(error),
      recoverable: isHLTBError(error) ? error.recoverable : false,
      userMessage: getUserMessage(error)
    };

    this.errorLog.push(entry);

    // Trim log if too large
    if (this.errorLog.length > this.MAX_LOG_SIZE) {
      this.errorLog.shift();
    }

    // Persist to storage for debugging
    this.persistErrorLog();
  }

  /**
   * Sanitize error context to prevent information disclosure
   */
  private sanitizeContext(context: any): any {
    if (!context || typeof context !== 'object') {
      return {};
    }

    // Whitelist safe properties only
    const safe: any = {};
    const allowedKeys = ['type', 'action', 'code', 'recoverable'];

    for (const key of allowedKeys) {
      if (key in context) {
        // Convert to string and limit length
        safe[key] = String(context[key]).substring(0, 100);
      }
    }

    return safe;
  }

  /**
   * Persist error log to storage with error handling
   */
  private persistErrorLog(): void {
    if (!this.config.enableStoragePersistence || typeof chrome === 'undefined' || !chrome.storage) {
      return;
    }

    try {
      chrome.storage.local.set({
        errorLog: this.errorLog.slice(-50) // Keep last 50 in storage
      }).catch((error) => {
        // Silently handle storage errors to prevent infinite loop
        console.warn('[HLTB] Failed to persist error log:', error);
      });
    } catch (error) {
      // Silently handle synchronous errors
    }
  }

  /**
   * Determine if error is critical
   */
  private isCritical(error: Error): boolean {
    // Critical error conditions
    if (error instanceof DatabaseLoadError) {
      return true;
    }

    if (error instanceof ValidationError) {
      return true;
    }

    // Generic critical patterns
    return (
      error.message.includes('undefined') ||
      error.message.includes('Cannot read') ||
      error.message.includes('is not a function') ||
      error.stack?.includes('service-worker') === true
    );
  }

  /**
   * Report error to monitoring service (if configured)
   */
  private reportError(error: Error, context: any): void {
    // In production, this would send to an error reporting service
    // For now, just log that we would report it
    if (process.env.NODE_ENV === 'production') {
      console.log('[HLTB] Would report critical error to monitoring service:', {
        error: error.message,
        code: getErrorCode(error),
        context
      });
    }
  }

  /**
   * Show user notification (sends message to content script)
   */
  showUserNotification(message: string, type: 'error' | 'warning' | 'info' = 'error'): void {
    // Only in browser context with Chrome APIs
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'showNotification',
          message,
          type
        }).catch(() => {
          // Ignore errors if content script not ready
        });
      }
    });
  }

  /**
   * Get error log
   */
  getErrorLog(): ErrorLogEntry[] {
    return [...this.errorLog];
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];

    if (this.config.enableStoragePersistence && typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.remove(['errorLog']);
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    critical: number;
    recoverable: number;
    byType: Record<string, number>;
  } {
    const stats = {
      total: this.errorLog.length,
      critical: 0,
      recoverable: 0,
      byType: {} as Record<string, number>
    };

    for (const entry of this.errorLog) {
      if (!entry.recoverable) {
        stats.critical++;
      } else {
        stats.recoverable++;
      }

      stats.byType[entry.code] = (stats.byType[entry.code] || 0) + 1;
    }

    return stats;
  }
}

/**
 * Convenience function to get error handler instance
 */
export function getErrorHandler(config?: ErrorHandlerConfig): ErrorHandler {
  return ErrorHandler.getInstance(config);
}
