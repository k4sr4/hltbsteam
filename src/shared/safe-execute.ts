/**
 * Safe Execution Wrappers for HLTB Steam Extension
 *
 * Provides utility functions to wrap operations in try-catch blocks
 * with automatic error handling and recovery.
 */

import { ErrorHandler } from './error-handler';
import { isRecoverableError, getUserMessage } from './errors';

/**
 * Safely execute an async function with automatic error handling
 *
 * @param fn - The async function to execute
 * @param fallback - Optional fallback value to return on error
 * @param errorHandler - Optional custom error handler function
 * @returns The result of fn() or fallback on error
 *
 * @example
 * const data = await safeExecute(
 *   async () => fetchGameData(title),
 *   null,
 *   (error) => console.error('Custom handling:', error)
 * );
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  fallback?: T,
  errorHandler?: (error: Error) => void
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    const handler = errorHandler || ((e: Error) => ErrorHandler.getInstance().handleError(e));
    handler(error as Error);
    return fallback;
  }
}

/**
 * Safely execute a synchronous function with automatic error handling
 *
 * @param fn - The function to execute
 * @param fallback - Optional fallback value to return on error
 * @param errorHandler - Optional custom error handler function
 * @returns The result of fn() or fallback on error
 *
 * @example
 * const result = safeExecuteSync(
 *   () => parseJSON(data),
 *   null
 * );
 */
export function safeExecuteSync<T>(
  fn: () => T,
  fallback?: T,
  errorHandler?: (error: Error) => void
): T | undefined {
  try {
    return fn();
  } catch (error) {
    const handler = errorHandler || ((e: Error) => ErrorHandler.getInstance().handleError(e));
    handler(error as Error);
    return fallback;
  }
}

/**
 * Wrap a function with error boundary that catches and handles errors
 *
 * @param fn - The function to wrap
 * @returns Wrapped function with error handling
 *
 * @example
 * const safeProcessGame = withErrorBoundary(processGame);
 * await safeProcessGame(gameTitle); // Errors automatically handled
 */
export function withErrorBoundary<T extends (...args: any[]) => any>(fn: T): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args);

      // Handle async functions
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

/**
 * Wrap a function with error boundary that swallows errors instead of rethrowing
 *
 * @param fn - The function to wrap
 * @param fallback - Optional fallback value to return on error
 * @returns Wrapped function that never throws
 *
 * @example
 * const safeGetCache = withSafeErrorBoundary(getCacheData, {});
 * const cache = await safeGetCache(key); // Never throws, returns {} on error
 */
export function withSafeErrorBoundary<T extends (...args: any[]) => any>(
  fn: T,
  fallback?: ReturnType<T>
): (...args: Parameters<T>) => Promise<ReturnType<T> | undefined> {
  return async (...args: Parameters<T>) => {
    try {
      const result = fn(...args);

      // Handle async functions
      if (result instanceof Promise) {
        return await result.catch((error) => {
          ErrorHandler.getInstance().handleError(error);
          return fallback;
        });
      }

      return result;
    } catch (error) {
      ErrorHandler.getInstance().handleError(error as Error);
      return fallback;
    }
  };
}

/**
 * Retry a function multiple times with exponential backoff
 *
 * @param fn - The async function to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelay - Base delay in ms between retries (default: 1000)
 * @param shouldRetry - Optional function to determine if error should trigger retry
 * @returns The result of fn() or throws last error
 *
 * @example
 * const data = await retryWithBackoff(
 *   async () => fetchFromAPI(gameTitle),
 *   3,
 *   1000,
 *   (error) => error.name === 'NetworkError'
 * );
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  shouldRetry?: (error: Error) => boolean
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      if (shouldRetry && !shouldRetry(lastError)) {
        throw lastError;
      }

      // Don't retry if not recoverable
      if (!isRecoverableError(lastError)) {
        throw lastError;
      }

      // Last attempt - throw error
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Wait before retry with exponential backoff (capped at 30s)
      const MAX_DELAY = 30000;
      const delay = Math.min(baseDelay * Math.pow(2, attempt), MAX_DELAY);
      console.log(`[HLTB] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * Execute function with timeout
 *
 * @param fn - The async function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutMessage - Optional custom timeout error message
 * @returns The result of fn() or throws TimeoutError
 *
 * @example
 * const data = await withTimeout(
 *   async () => fetchGameData(title),
 *   5000,
 *   'Fetch timed out'
 * );
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    )
  ]);
}

/**
 * Batch execute multiple async operations with error handling
 *
 * @param operations - Array of async functions to execute
 * @param continueOnError - Whether to continue on individual errors (default: true)
 * @returns Array of results and errors
 *
 * @example
 * const results = await batchExecute([
 *   () => fetchGame('Game 1'),
 *   () => fetchGame('Game 2'),
 *   () => fetchGame('Game 3')
 * ]);
 */
export async function batchExecute<T>(
  operations: Array<() => Promise<T>>,
  continueOnError: boolean = true
): Promise<Array<{ success: boolean; data?: T; error?: Error }>> {
  const results: Array<{ success: boolean; data?: T; error?: Error }> = [];

  for (const operation of operations) {
    try {
      const data = await operation();
      results.push({ success: true, data });
    } catch (error) {
      ErrorHandler.getInstance().handleError(error as Error);
      results.push({ success: false, error: error as Error });

      if (!continueOnError) {
        break;
      }
    }
  }

  return results;
}

/**
 * Create a debounced version of a function with error handling
 *
 * @param fn - The function to debounce
 * @param delayMs - Delay in milliseconds
 * @returns Debounced function
 *
 * @example
 * const debouncedSearch = debounce(
 *   async (query) => searchGames(query),
 *   300
 * );
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(async () => {
      try {
        await fn(...args);
      } catch (error) {
        ErrorHandler.getInstance().handleError(error as Error);
      }
    }, delayMs);
  };
}

/**
 * Sleep helper function
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a memoized version of a function with error handling
 *
 * @param fn - The function to memoize
 * @param keyFn - Optional function to generate cache key from arguments
 * @returns Memoized function
 *
 * @example
 * const memoizedNormalize = memoize(
 *   (title: string) => normalizeTitle(title)
 * );
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyFn?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>) => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    try {
      const result = fn(...args);

      // Handle async functions
      if (result instanceof Promise) {
        return result
          .then((value) => {
            cache.set(key, value);
            return value;
          })
          .catch((error) => {
            ErrorHandler.getInstance().handleError(error);
            throw error;
          });
      }

      cache.set(key, result);
      return result;
    } catch (error) {
      ErrorHandler.getInstance().handleError(error as Error);
      throw error;
    }
  }) as T;
}
