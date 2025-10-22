/**
 * Test Utilities Index
 *
 * Central export for all test utilities
 */

// Factory functions
export * from './factories';

// DOM utilities
export * from './dom-utils';

// Chrome API utilities
export * from './chrome-utils';

// Async utilities
export * from './async-utils';

// Assertion utilities
export * from './assertion-utils';

// Re-export commonly used utilities
import {
  createMockHLTBData,
  createMockDisplayConfig,
  createMockGameInfo,
  createMockCallbacks
} from './factories';

import {
  setupStorePageDOM,
  setupCommunityPageDOM,
  cleanupDOM,
  createMockElement,
  createMockShadowRoot
} from './dom-utils';

import {
  resetChromeMocks,
  mockSendMessage,
  mockStorageGet
} from './chrome-utils';

import {
  waitFor,
  sleep,
  flushPromises
} from './async-utils';

import {
  expectPerformanceMetrics,
  expectTextContent,
  expectShadowElement,
  registerCustomMatchers
} from './assertion-utils';

export const TestHelpers = {
  // Factories
  createMockHLTBData,
  createMockDisplayConfig,
  createMockGameInfo,
  createMockCallbacks,

  // DOM
  setupStorePageDOM,
  setupCommunityPageDOM,
  cleanupDOM,
  createMockElement,
  createMockShadowRoot,

  // Chrome
  resetChromeMocks,
  mockSendMessage,
  mockStorageGet,

  // Async
  waitFor,
  sleep,
  flushPromises,

  // Assertions
  expectPerformanceMetrics,
  expectTextContent,
  expectShadowElement,
  registerCustomMatchers
};

export default TestHelpers;
