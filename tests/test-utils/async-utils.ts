/**
 * Async Testing Utilities
 *
 * Helper functions for handling async operations and timing in tests
 */

/**
 * Waits for a condition to be true
 *
 * @param condition - Function that returns true when condition is met
 * @param timeout - Maximum time to wait in milliseconds
 * @param interval - Check interval in milliseconds
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 1000,
  interval: number = 10
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await Promise.resolve(condition());
    if (result) {
      return;
    }
    await sleep(interval);
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Sleeps for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Runs an async function with a timeout
 *
 * @param fn - Async function to run
 * @param timeout - Timeout in milliseconds
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeout: number
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
    )
  ]);
}

/**
 * Flushes all pending promises
 */
export async function flushPromises(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

/**
 * Waits for next tick
 */
export async function nextTick(): Promise<void> {
  return new Promise(resolve => process.nextTick(resolve));
}

/**
 * Advances timers and flushes promises
 */
export async function advanceTimersAndFlush(ms: number): Promise<void> {
  jest.advanceTimersByTime(ms);
  await flushPromises();
}

/**
 * Runs test with fake timers
 */
export async function withFakeTimers(
  fn: () => Promise<void> | void
): Promise<void> {
  jest.useFakeTimers();
  try {
    await fn();
  } finally {
    jest.useRealTimers();
  }
}

/**
 * Waits for all pending setTimeouts to complete
 */
export async function waitForPendingTimeouts(): Promise<void> {
  jest.runOnlyPendingTimers();
  await flushPromises();
}

/**
 * Waits for all timers to complete
 */
export async function waitForAllTimers(): Promise<void> {
  jest.runAllTimers();
  await flushPromises();
}

/**
 * Retries an async function until it succeeds or max attempts reached
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 100
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Runs multiple async functions in sequence
 */
export async function runInSequence<T>(
  functions: Array<() => Promise<T>>
): Promise<T[]> {
  const results: T[] = [];

  for (const fn of functions) {
    results.push(await fn());
  }

  return results;
}

/**
 * Runs multiple async functions in parallel
 */
export async function runInParallel<T>(
  functions: Array<() => Promise<T>>
): Promise<T[]> {
  return Promise.all(functions.map(fn => fn()));
}

/**
 * Waits for a callback to be called
 */
export async function waitForCallback(
  mockFn: jest.Mock,
  timeout: number = 1000
): Promise<any[]> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (mockFn.mock.calls.length > 0) {
      return mockFn.mock.calls[mockFn.mock.calls.length - 1];
    }
    await sleep(10);
  }

  throw new Error('Callback not called within timeout');
}

/**
 * Waits for a callback to be called N times
 */
export async function waitForCallbackCount(
  mockFn: jest.Mock,
  count: number,
  timeout: number = 1000
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (mockFn.mock.calls.length >= count) {
      return;
    }
    await sleep(10);
  }

  throw new Error(
    `Callback called ${mockFn.mock.calls.length} times, expected ${count} within timeout`
  );
}

/**
 * Debounces test execution (useful for testing debounced functions)
 */
export function createDebounceHelper(wait: number) {
  let timeoutId: NodeJS.Timeout | null = null;

  return {
    call: (fn: () => void) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(fn, wait);
    },
    flush: async () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      await flushPromises();
    }
  };
}

/**
 * Measures execution time of a function
 */
export async function measureTime<T>(
  fn: () => Promise<T> | T
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await Promise.resolve(fn());
  const duration = performance.now() - start;

  return { result, duration };
}

/**
 * Runs function and expects it to complete within time limit
 */
export async function expectTimingUnder<T>(
  fn: () => Promise<T> | T,
  maxMs: number
): Promise<T> {
  const { result, duration } = await measureTime(fn);

  expect(duration).toBeLessThan(maxMs);

  return result;
}

/**
 * Creates a deferred promise for manual resolution
 */
export function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * Waits for a promise to reject
 */
export async function expectRejection(
  promise: Promise<any>,
  expectedError?: string | RegExp
): Promise<void> {
  try {
    await promise;
    throw new Error('Expected promise to reject, but it resolved');
  } catch (error) {
    if (expectedError) {
      const errorMessage = (error as Error).message;
      if (typeof expectedError === 'string') {
        expect(errorMessage).toContain(expectedError);
      } else {
        expect(errorMessage).toMatch(expectedError);
      }
    }
  }
}

/**
 * Batch async operations with concurrency limit
 */
export async function batchAsync<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const promise = fn(item).then(result => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex(p => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}
