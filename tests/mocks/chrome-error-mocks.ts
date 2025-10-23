/**
 * Chrome API Error Mocks
 *
 * Provides mock implementations of Chrome APIs with various error scenarios
 * for comprehensive error handling testing.
 */

/**
 * Mock Chrome storage with error scenarios
 */
export class ChromeStorageMock {
  private data: Map<string, any> = new Map();
  private shouldFail: boolean = false;
  private failureType: 'quota' | 'corruption' | 'generic' | null = null;

  constructor() {
    this.reset();
  }

  /**
   * Reset storage to empty state
   */
  reset(): void {
    this.data.clear();
    this.shouldFail = false;
    this.failureType = null;
  }

  /**
   * Configure storage to fail with specific error
   */
  setFailureMode(type: 'quota' | 'corruption' | 'generic' | null): void {
    this.shouldFail = type !== null;
    this.failureType = type;
  }

  /**
   * Mock storage.local.get
   */
  get(keys?: string | string[] | object): Promise<any> {
    if (this.shouldFail) {
      return this.getError();
    }

    if (!keys) {
      // Return all data
      return Promise.resolve(Object.fromEntries(this.data));
    }

    if (typeof keys === 'string') {
      const value = this.data.get(keys);
      return Promise.resolve(value ? { [keys]: value } : {});
    }

    if (Array.isArray(keys)) {
      const result: any = {};
      keys.forEach(key => {
        if (this.data.has(key)) {
          result[key] = this.data.get(key);
        }
      });
      return Promise.resolve(result);
    }

    // Object with defaults
    const result: any = { ...keys };
    Object.keys(keys).forEach(key => {
      if (this.data.has(key)) {
        result[key] = this.data.get(key);
      }
    });
    return Promise.resolve(result);
  }

  /**
   * Mock storage.local.set
   */
  set(items: object): Promise<void> {
    if (this.shouldFail) {
      return this.getError();
    }

    Object.entries(items).forEach(([key, value]) => {
      this.data.set(key, value);
    });

    return Promise.resolve();
  }

  /**
   * Mock storage.local.remove
   */
  remove(keys: string | string[]): Promise<void> {
    if (this.shouldFail) {
      return this.getError();
    }

    const keysArray = Array.isArray(keys) ? keys : [keys];
    keysArray.forEach(key => this.data.delete(key));

    return Promise.resolve();
  }

  /**
   * Mock storage.local.clear
   */
  clear(): Promise<void> {
    if (this.shouldFail) {
      return this.getError();
    }

    this.data.clear();
    return Promise.resolve();
  }

  /**
   * Get appropriate error based on failure type
   */
  private getError(): Promise<never> {
    let error: Error;

    switch (this.failureType) {
      case 'quota':
        error = new Error('QuotaExceededError: Storage quota exceeded');
        error.name = 'QuotaExceededError';
        break;

      case 'corruption':
        error = new Error('Storage corruption detected');
        break;

      case 'generic':
      default:
        error = new Error('Storage operation failed');
        break;
    }

    return Promise.reject(error);
  }

  /**
   * Get current storage state for assertions
   */
  getState(): Map<string, any> {
    return new Map(this.data);
  }
}

/**
 * Mock Chrome runtime with error scenarios
 */
export class ChromeRuntimeMock {
  private listeners: Map<string, Array<(...args: any[]) => void>> = new Map();
  private shouldFail: boolean = false;
  private failureType: 'timeout' | 'context_invalid' | 'no_response' | null = null;
  private responseDelay: number = 0;

  constructor() {
    this.reset();
  }

  /**
   * Reset runtime to initial state
   */
  reset(): void {
    this.listeners.clear();
    this.shouldFail = false;
    this.failureType = null;
    this.responseDelay = 0;
  }

  /**
   * Configure runtime to fail with specific error
   */
  setFailureMode(
    type: 'timeout' | 'context_invalid' | 'no_response' | null,
    delayMs: number = 0
  ): void {
    this.shouldFail = type !== null;
    this.failureType = type;
    this.responseDelay = delayMs;
  }

  /**
   * Mock runtime.sendMessage
   */
  sendMessage(message: any): Promise<any> {
    if (this.shouldFail) {
      return this.getError();
    }

    // Simulate network delay
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, data: {} });
      }, this.responseDelay);
    });
  }

  /**
   * Mock runtime.onMessage.addListener
   */
  addMessageListener(callback: (...args: any[]) => void): void {
    if (!this.listeners.has('message')) {
      this.listeners.set('message', []);
    }
    this.listeners.get('message')!.push(callback);
  }

  /**
   * Mock runtime.onMessage.removeListener
   */
  removeMessageListener(callback: (...args: any[]) => void): void {
    const listeners = this.listeners.get('message');
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Simulate message received (for testing)
   */
  simulateMessageReceived(message: any, sender: any, sendResponse: (response: any) => void): void {
    const listeners = this.listeners.get('message') || [];
    listeners.forEach(listener => {
      try {
        listener(message, sender, sendResponse);
      } catch (error) {
        console.error('Message listener error:', error);
      }
    });
  }

  /**
   * Get appropriate error based on failure type
   */
  private getError(): Promise<never> {
    let error: Error;

    switch (this.failureType) {
      case 'timeout':
        error = new Error('Message timeout');
        error.name = 'TimeoutError';
        break;

      case 'context_invalid':
        error = new Error('Extension context invalidated');
        error.name = 'ContextInvalidatedError';
        break;

      case 'no_response':
        return new Promise(() => {
          // Never resolves or rejects
        });

      default:
        error = new Error('Runtime error');
        break;
    }

    return Promise.reject(error);
  }

  /**
   * Get listener count for assertions
   */
  getListenerCount(event: string): number {
    return this.listeners.get(event)?.length || 0;
  }
}

/**
 * Mock Chrome tabs with error scenarios
 */
export class ChromeTabsMock {
  private shouldFail: boolean = false;
  private failureType: 'no_tab' | 'permission_denied' | null = null;

  constructor() {
    this.reset();
  }

  /**
   * Reset tabs mock
   */
  reset(): void {
    this.shouldFail = false;
    this.failureType = null;
  }

  /**
   * Configure tabs to fail
   */
  setFailureMode(type: 'no_tab' | 'permission_denied' | null): void {
    this.shouldFail = type !== null;
    this.failureType = type;
  }

  /**
   * Mock tabs.query
   */
  query(queryInfo: any): Promise<any[]> {
    if (this.shouldFail && this.failureType === 'no_tab') {
      return Promise.resolve([]);
    }

    if (this.shouldFail && this.failureType === 'permission_denied') {
      return Promise.reject(new Error('Permission denied'));
    }

    // Return mock active tab
    return Promise.resolve([
      {
        id: 123,
        url: 'https://store.steampowered.com/app/12345/Test_Game/',
        active: true
      }
    ]);
  }

  /**
   * Mock tabs.sendMessage
   */
  sendMessage(tabId: number, message: any): Promise<any> {
    if (this.shouldFail) {
      return Promise.reject(new Error('Could not establish connection'));
    }

    return Promise.resolve({ success: true });
  }
}

/**
 * Setup complete Chrome API mocks with error scenarios
 */
export function setupChromeMocksWithErrors() {
  const storageMock = new ChromeStorageMock();
  const runtimeMock = new ChromeRuntimeMock();
  const tabsMock = new ChromeTabsMock();

  // Override global chrome object
  (global as any).chrome = {
    storage: {
      local: {
        get: jest.fn((keys?: any) => storageMock.get(keys)),
        set: jest.fn((items: any) => storageMock.set(items)),
        remove: jest.fn((keys: any) => storageMock.remove(keys)),
        clear: jest.fn(() => storageMock.clear())
      }
    },
    runtime: {
      sendMessage: jest.fn((message: any) => runtimeMock.sendMessage(message)),
      onMessage: {
        addListener: jest.fn((callback: any) => runtimeMock.addMessageListener(callback)),
        removeListener: jest.fn((callback: any) => runtimeMock.removeMessageListener(callback))
      },
      lastError: null
    },
    tabs: {
      query: jest.fn((queryInfo: any) => tabsMock.query(queryInfo)),
      sendMessage: jest.fn((tabId: number, message: any) => tabsMock.sendMessage(tabId, message))
    }
  };

  return {
    storage: storageMock,
    runtime: runtimeMock,
    tabs: tabsMock,
    reset: () => {
      storageMock.reset();
      runtimeMock.reset();
      tabsMock.reset();
      jest.clearAllMocks();
    }
  };
}

/**
 * Common error scenarios for quick setup
 */
export const ERROR_SCENARIOS = {
  /**
   * Simulate storage quota exceeded
   */
  storageQuotaExceeded: (mocks: ReturnType<typeof setupChromeMocksWithErrors>) => {
    mocks.storage.setFailureMode('quota');
  },

  /**
   * Simulate storage corruption
   */
  storageCorruption: (mocks: ReturnType<typeof setupChromeMocksWithErrors>) => {
    mocks.storage.setFailureMode('corruption');
  },

  /**
   * Simulate extension context invalidated
   */
  contextInvalidated: (mocks: ReturnType<typeof setupChromeMocksWithErrors>) => {
    mocks.runtime.setFailureMode('context_invalid');
  },

  /**
   * Simulate message timeout
   */
  messageTimeout: (mocks: ReturnType<typeof setupChromeMocksWithErrors>, timeoutMs: number = 5000) => {
    mocks.runtime.setFailureMode('timeout', timeoutMs);
  },

  /**
   * Simulate no active tab
   */
  noActiveTab: (mocks: ReturnType<typeof setupChromeMocksWithErrors>) => {
    mocks.tabs.setFailureMode('no_tab');
  },

  /**
   * Simulate permission denied
   */
  permissionDenied: (mocks: ReturnType<typeof setupChromeMocksWithErrors>) => {
    mocks.tabs.setFailureMode('permission_denied');
  },

  /**
   * Simulate all systems failing
   */
  totalFailure: (mocks: ReturnType<typeof setupChromeMocksWithErrors>) => {
    mocks.storage.setFailureMode('generic');
    mocks.runtime.setFailureMode('context_invalid');
    mocks.tabs.setFailureMode('no_tab');
  }
};

/**
 * Network error simulator
 */
export function simulateNetworkError(type: 'offline' | 'timeout' | 'dns_failure' | '500_error') {
  const errors: Record<string, Error> = {
    offline: (() => {
      const err = new Error('Network request failed');
      err.name = 'NetworkError';
      return err;
    })(),
    timeout: (() => {
      const err = new Error('Request timeout');
      err.name = 'TimeoutError';
      return err;
    })(),
    dns_failure: (() => {
      const err = new Error('DNS lookup failed');
      err.name = 'DNSError';
      return err;
    })(),
    '500_error': new Error('Internal Server Error')
  };

  return errors[type];
}
