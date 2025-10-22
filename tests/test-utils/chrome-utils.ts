/**
 * Chrome API Testing Utilities
 *
 * Helper functions for mocking and testing Chrome Extension APIs
 */

import { MessageResponse } from './factories';

/**
 * Resets all Chrome API mocks
 */
export function resetChromeMocks(): void {
  jest.clearAllMocks();

  // Reset specific Chrome API mocks
  if (typeof chrome !== 'undefined') {
    (chrome.runtime.sendMessage as jest.Mock).mockClear();
    (chrome.runtime.onMessage.addListener as jest.Mock).mockClear();
    (chrome.storage.local.get as jest.Mock).mockClear();
    (chrome.storage.local.set as jest.Mock).mockClear();
    (chrome.storage.local.remove as jest.Mock).mockClear();
    (chrome.storage.local.clear as jest.Mock).mockClear();
  }
}

/**
 * Mocks chrome.runtime.sendMessage with a response
 */
export function mockSendMessage(response: MessageResponse): void {
  (chrome.runtime.sendMessage as jest.Mock).mockResolvedValue(response);
}

/**
 * Mocks chrome.runtime.sendMessage with multiple responses
 */
export function mockSendMessageSequence(responses: MessageResponse[]): void {
  let callCount = 0;
  (chrome.runtime.sendMessage as jest.Mock).mockImplementation(() => {
    const response = responses[callCount] || responses[responses.length - 1];
    callCount++;
    return Promise.resolve(response);
  });
}

/**
 * Mocks chrome.runtime.sendMessage to fail
 */
export function mockSendMessageError(error: string = 'Network error'): void {
  (chrome.runtime.sendMessage as jest.Mock).mockRejectedValue(new Error(error));
}

/**
 * Mocks chrome.storage.local.get with data
 */
export function mockStorageGet(data: Record<string, any>): void {
  (chrome.storage.local.get as jest.Mock).mockResolvedValue(data);
}

/**
 * Mocks chrome.storage.local.set
 */
export function mockStorageSet(): void {
  (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);
}

/**
 * Mocks chrome.storage.local operations to fail
 */
export function mockStorageError(error: string = 'Storage unavailable'): void {
  (chrome.storage.local.get as jest.Mock).mockRejectedValue(new Error(error));
  (chrome.storage.local.set as jest.Mock).mockRejectedValue(new Error(error));
  (chrome.storage.local.remove as jest.Mock).mockRejectedValue(new Error(error));
}

/**
 * Sets up message listener and returns handler function
 */
export function setupMessageListener(): {
  handler: jest.Mock;
  sendResponse: jest.Mock;
  triggerMessage: (message: any) => Promise<void>;
} {
  const handler = jest.fn();
  const sendResponse = jest.fn();

  (chrome.runtime.onMessage.addListener as jest.Mock).mockImplementation(
    (callback: Function) => {
      handler.mockImplementation(callback);
    }
  );

  return {
    handler,
    sendResponse,
    triggerMessage: async (message: any) => {
      await handler(message, {}, sendResponse);
    }
  };
}

/**
 * Waits for chrome.runtime.sendMessage to be called
 */
export async function waitForSendMessage(
  timeout: number = 1000
): Promise<any> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if ((chrome.runtime.sendMessage as jest.Mock).mock.calls.length > 0) {
      return (chrome.runtime.sendMessage as jest.Mock).mock.calls[0][0];
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  throw new Error('sendMessage not called within timeout');
}

/**
 * Waits for chrome.storage.local.set to be called
 */
export async function waitForStorageSet(
  timeout: number = 1000
): Promise<any> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if ((chrome.storage.local.set as jest.Mock).mock.calls.length > 0) {
      return (chrome.storage.local.set as jest.Mock).mock.calls[0][0];
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  throw new Error('storage.set not called within timeout');
}

/**
 * Gets all chrome.runtime.sendMessage calls
 */
export function getSendMessageCalls(): any[] {
  return (chrome.runtime.sendMessage as jest.Mock).mock.calls.map(call => call[0]);
}

/**
 * Gets all chrome.storage.local.set calls
 */
export function getStorageSetCalls(): any[] {
  return (chrome.storage.local.set as jest.Mock).mock.calls.map(call => call[0]);
}

/**
 * Asserts sendMessage was called with specific action
 */
export function expectSendMessageWithAction(action: string): void {
  const calls = getSendMessageCalls();
  const found = calls.some(call => call.action === action);

  expect(found).toBe(true);
  if (!found) {
    throw new Error(
      `Expected sendMessage to be called with action "${action}", but it wasn't. ` +
      `Actual calls: ${JSON.stringify(calls)}`
    );
  }
}

/**
 * Asserts storage was set with specific key
 */
export function expectStorageSetWithKey(key: string): void {
  const calls = getStorageSetCalls();
  const found = calls.some(call => key in call);

  expect(found).toBe(true);
  if (!found) {
    throw new Error(
      `Expected storage.set to be called with key "${key}", but it wasn't. ` +
      `Actual calls: ${JSON.stringify(calls)}`
    );
  }
}

/**
 * Creates a mock Chrome runtime context
 */
export function createMockRuntimeContext() {
  return {
    id: 'test-extension-id',
    getURL: jest.fn((path: string) => `chrome-extension://test-id/${path}`),
    getManifest: jest.fn(() => ({
      name: 'HLTB Steam Extension',
      version: '1.0.0',
      manifest_version: 3
    }))
  };
}

/**
 * Mocks Chrome alarm API
 */
export function mockAlarmAPI(): {
  triggerAlarm: (alarmName: string) => void;
  getCreatedAlarms: () => string[];
} {
  const alarms = new Map<string, chrome.alarms.Alarm>();

  (chrome.alarms.create as jest.Mock).mockImplementation(
    (name: string, alarmInfo: chrome.alarms.AlarmCreateInfo) => {
      alarms.set(name, {
        name,
        scheduledTime: Date.now() + (alarmInfo.delayInMinutes || 0) * 60000,
        periodInMinutes: alarmInfo.periodInMinutes
      });
    }
  );

  (chrome.alarms.clear as jest.Mock).mockImplementation((name: string) => {
    alarms.delete(name);
    return Promise.resolve(true);
  });

  let alarmCallback: ((alarm: chrome.alarms.Alarm) => void) | null = null;

  (chrome.alarms.onAlarm.addListener as jest.Mock).mockImplementation(
    (callback: (alarm: chrome.alarms.Alarm) => void) => {
      alarmCallback = callback;
    }
  );

  return {
    triggerAlarm: (alarmName: string) => {
      const alarm = alarms.get(alarmName);
      if (alarm && alarmCallback) {
        alarmCallback(alarm);
      }
    },
    getCreatedAlarms: () => Array.from(alarms.keys())
  };
}

/**
 * Simulates extension runtime error
 */
export function simulateRuntimeError(errorMessage: string): void {
  chrome.runtime.lastError = { message: errorMessage };
}

/**
 * Clears runtime error
 */
export function clearRuntimeError(): void {
  chrome.runtime.lastError = null;
}

/**
 * Asserts no Chrome runtime errors
 */
export function expectNoRuntimeError(): void {
  expect(chrome.runtime.lastError).toBeNull();
}

/**
 * Mocks chrome.tabs API
 */
export function mockTabsAPI() {
  const tabs: chrome.tabs.Tab[] = [];

  (chrome.tabs.create as jest.Mock).mockImplementation((createProperties) => {
    const tab: chrome.tabs.Tab = {
      id: tabs.length + 1,
      index: tabs.length,
      pinned: false,
      highlighted: false,
      windowId: 1,
      active: createProperties.active ?? true,
      incognito: false,
      selected: false,
      discarded: false,
      autoDiscardable: true,
      groupId: -1,
      url: createProperties.url,
      ...createProperties
    };
    tabs.push(tab);
    return Promise.resolve(tab);
  });

  (chrome.tabs.query as jest.Mock).mockImplementation((queryInfo) => {
    return Promise.resolve(tabs.filter(tab => {
      if (queryInfo.active !== undefined && tab.active !== queryInfo.active) {
        return false;
      }
      if (queryInfo.url && tab.url !== queryInfo.url) {
        return false;
      }
      return true;
    }));
  });

  return {
    getTabs: () => [...tabs],
    clearTabs: () => tabs.length = 0
  };
}

/**
 * Captures all console.log calls
 */
export function captureConsoleLogs(): {
  logs: any[][];
  restore: () => void;
} {
  const logs: any[][] = [];
  const originalLog = console.log;

  console.log = jest.fn((...args: any[]) => {
    logs.push(args);
  });

  return {
    logs,
    restore: () => {
      console.log = originalLog;
    }
  };
}

/**
 * Captures all console.error calls
 */
export function captureConsoleErrors(): {
  errors: any[][];
  restore: () => void;
} {
  const errors: any[][] = [];
  const originalError = console.error;

  console.error = jest.fn((...args: any[]) => {
    errors.push(args);
  });

  return {
    errors,
    restore: () => {
      console.error = originalError;
    }
  };
}
