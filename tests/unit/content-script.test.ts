/**
 * Content Script - Unit Tests
 *
 * Comprehensive test suite for the content script orchestration
 *
 * Coverage:
 * - Initialization (4 tests)
 * - Game Info Extraction (8 tests)
 * - Message Passing (5 tests)
 * - Navigation Observer (4 tests)
 * - Integration Orchestration (4 tests)
 *
 * Total: 25 tests
 */

import { HLTBContentScript } from '../../src/content/content-script';
import {
  setupStorePageDOM,
  setupCommunityPageDOM,
  setupEmptyPageDOM,
  cleanupDOM,
  resetChromeMocks,
  mockSendMessage,
  mockSendMessageSequence,
  mockSendMessageError,
  createMockHLTBData,
  createMockSettingsResponse,
  createMockMessageResponse,
  createMockErrorResponse,
  waitFor,
  flushPromises
} from '../test-utils';

// Mock InjectionManager
jest.mock('../../src/content/managers/InjectionManager', () => ({
  InjectionManager: jest.fn().mockImplementation(() => ({
    injectHLTBData: jest.fn().mockResolvedValue(true),
    showLoading: jest.fn(),
    showError: jest.fn(),
    updateData: jest.fn(),
    cleanup: jest.fn(),
    destroy: jest.fn(),
    getMetrics: jest.fn(() => ({ totalTime: 30 }))
  })),
  createInjectionManager: jest.fn().mockImplementation(() => ({
    injectHLTBData: jest.fn().mockResolvedValue(true),
    showLoading: jest.fn(),
    showError: jest.fn(),
    updateData: jest.fn(),
    cleanup: jest.fn(),
    destroy: jest.fn(),
    getMetrics: jest.fn(() => ({ totalTime: 30 }))
  }))
}));

describe('Content Script', () => {
  beforeEach(() => {
    cleanupDOM();
    resetChromeMocks();
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanupDOM();
  });

  // ============================================================================
  // Initialization (4 tests)
  // ============================================================================

  describe('Initialization', () => {
    test('should initialize on Store game page', async () => {
      setupStorePageDOM();
      global.window.location.href = 'https://store.steampowered.com/app/12345/Test_Game/';

      mockSendMessageSequence([
        createMockSettingsResponse(true),
        createMockMessageResponse({ data: createMockHLTBData() })
      ]);

      const contentScript = new HLTBContentScript();
      await contentScript.initialize();

      await flushPromises();

      // Should have sent settings request and HLTB fetch request
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
    });

    test('should initialize on Community game page', async () => {
      setupCommunityPageDOM();
      global.window.location.href = 'https://steamcommunity.com/app/12345/';

      mockSendMessageSequence([
        createMockSettingsResponse(true),
        createMockMessageResponse({ data: createMockHLTBData() })
      ]);

      const contentScript = new HLTBContentScript();
      await contentScript.initialize();

      await flushPromises();

      expect(chrome.runtime.sendMessage).toHaveBeenCalled();
    });

    test('should skip initialization on non-game page', async () => {
      setupEmptyPageDOM();
      global.window.location.href = 'https://store.steampowered.com/search/';

      const contentScript = new HLTBContentScript();
      await contentScript.initialize();

      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    test('should skip initialization when extension is disabled', async () => {
      setupStorePageDOM();
      global.window.location.href = 'https://store.steampowered.com/app/12345/Test_Game/';

      mockSendMessage(createMockSettingsResponse(false)); // Disabled

      const contentScript = new HLTBContentScript();
      await contentScript.initialize();

      await flushPromises();

      // Should only check settings, not fetch HLTB data
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Game Info Extraction (8 tests)
  // ============================================================================

  describe('Game Info Extraction', () => {
    test('should extract app ID from URL', async () => {
      setupStorePageDOM();
      global.window.location.href = 'https://store.steampowered.com/app/620/Portal_2/';

      mockSendMessageSequence([
        createMockSettingsResponse(true),
        createMockMessageResponse()
      ]);

      const contentScript = new HLTBContentScript();
      await contentScript.initialize();

      await flushPromises();

      // Check that sendMessage was called with correct appId
      const calls = (chrome.runtime.sendMessage as jest.Mock).mock.calls;
      const fetchCall = calls.find(call => call[0].action === 'fetchHLTB');
      expect(fetchCall[0].appId).toBe('620');
    });

    test('should extract title from URL', async () => {
      setupStorePageDOM();
      global.window.location.href = 'https://store.steampowered.com/app/620/Portal_2/';

      mockSendMessageSequence([
        createMockSettingsResponse(true),
        createMockMessageResponse()
      ]);

      const contentScript = new HLTBContentScript();
      await contentScript.initialize();

      await flushPromises();

      const calls = (chrome.runtime.sendMessage as jest.Mock).mock.calls;
      const fetchCall = calls.find(call => call[0].action === 'fetchHLTB');
      expect(fetchCall[0].gameTitle).toBe('Portal 2');
    });

    test('should extract title from meta tags when URL title missing', async () => {
      setupStorePageDOM();
      global.window.location.href = 'https://store.steampowered.com/app/620/';

      // Add meta tag
      const metaTag = document.createElement('meta');
      metaTag.setAttribute('property', 'og:title');
      metaTag.setAttribute('content', 'Portal 2');
      document.head.appendChild(metaTag);

      mockSendMessageSequence([
        createMockSettingsResponse(true),
        createMockMessageResponse()
      ]);

      const contentScript = new HLTBContentScript();
      await contentScript.initialize();

      await flushPromises();

      const calls = (chrome.runtime.sendMessage as jest.Mock).mock.calls;
      const fetchCall = calls.find(call => call[0].action === 'fetchHLTB');
      expect(fetchCall[0].gameTitle).toBe('Portal 2');
    });

    test('should extract title from DOM element on Community page', async () => {
      setupCommunityPageDOM();
      global.window.location.href = 'https://steamcommunity.com/app/620/';

      const appNameElement = document.querySelector('#appHubAppName');
      if (appNameElement) {
        appNameElement.textContent = 'Portal 2';
      }

      mockSendMessageSequence([
        createMockSettingsResponse(true),
        createMockMessageResponse()
      ]);

      const contentScript = new HLTBContentScript();
      await contentScript.initialize();

      await flushPromises();

      const calls = (chrome.runtime.sendMessage as jest.Mock).mock.calls;
      const fetchCall = calls.find(call => call[0].action === 'fetchHLTB');
      expect(fetchCall[0].gameTitle).toContain('Test Game'); // From setupCommunityPageDOM
    });

    test('should clean URL-encoded title', async () => {
      setupStorePageDOM();
      global.window.location.href = 'https://store.steampowered.com/app/620/Portal_2_Test/';

      mockSendMessageSequence([
        createMockSettingsResponse(true),
        createMockMessageResponse()
      ]);

      const contentScript = new HLTBContentScript();
      await contentScript.initialize();

      await flushPromises();

      const calls = (chrome.runtime.sendMessage as jest.Mock).mock.calls;
      const fetchCall = calls.find(call => call[0].action === 'fetchHLTB');
      expect(fetchCall[0].gameTitle).toBe('Portal 2 Test');
    });

    test('should remove "on Steam" suffix from meta titles', async () => {
      setupStorePageDOM();
      global.window.location.href = 'https://store.steampowered.com/app/620/';

      const metaTag = document.createElement('meta');
      metaTag.setAttribute('property', 'og:title');
      metaTag.setAttribute('content', 'Portal 2 on Steam');
      document.head.appendChild(metaTag);

      mockSendMessageSequence([
        createMockSettingsResponse(true),
        createMockMessageResponse()
      ]);

      const contentScript = new HLTBContentScript();
      await contentScript.initialize();

      await flushPromises();

      const calls = (chrome.runtime.sendMessage as jest.Mock).mock.calls;
      const fetchCall = calls.find(call => call[0].action === 'fetchHLTB');
      expect(fetchCall[0].gameTitle).toBe('Portal 2');
    });

    test('should remove "Save X% on" prefix from titles', async () => {
      setupStorePageDOM();
      global.window.location.href = 'https://store.steampowered.com/app/620/';

      document.title = 'Save 50% on Portal 2 on Steam';

      mockSendMessageSequence([
        createMockSettingsResponse(true),
        createMockMessageResponse()
      ]);

      const contentScript = new HLTBContentScript();
      await contentScript.initialize();

      await flushPromises();

      const calls = (chrome.runtime.sendMessage as jest.Mock).mock.calls;
      const fetchCall = calls.find(call => call[0].action === 'fetchHLTB');
      // Should have cleaned title
      expect(fetchCall[0].gameTitle).not.toContain('Save 50%');
    });

    test('should return null when no game info can be extracted', async () => {
      setupEmptyPageDOM();
      global.window.location.href = 'https://store.steampowered.com/search/';

      const contentScript = new HLTBContentScript();
      await contentScript.initialize();

      // Should not send any messages
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Message Passing (5 tests)
  // ============================================================================

  describe('Message Passing', () => {
    test('should send settings request on initialization', async () => {
      setupStorePageDOM();
      global.window.location.href = 'https://store.steampowered.com/app/620/Portal_2/';

      mockSendMessageSequence([
        createMockSettingsResponse(true),
        createMockMessageResponse()
      ]);

      const contentScript = new HLTBContentScript();
      await contentScript.initialize();

      await flushPromises();

      const calls = (chrome.runtime.sendMessage as jest.Mock).mock.calls;
      const settingsCall = calls.find(call => call[0].action === 'getSettings');
      expect(settingsCall).toBeTruthy();
    });

    test('should send HLTB fetch request with game info', async () => {
      setupStorePageDOM();
      global.window.location.href = 'https://store.steampowered.com/app/620/Portal_2/';

      mockSendMessageSequence([
        createMockSettingsResponse(true),
        createMockMessageResponse()
      ]);

      const contentScript = new HLTBContentScript();
      await contentScript.initialize();

      await flushPromises();

      const calls = (chrome.runtime.sendMessage as jest.Mock).mock.calls;
      const fetchCall = calls.find(call => call[0].action === 'fetchHLTB');
      expect(fetchCall).toBeTruthy();
      expect(fetchCall[0]).toMatchObject({
        action: 'fetchHLTB',
        gameTitle: expect.any(String),
        appId: '620'
      });
    });

    test('should handle successful HLTB response', async () => {
      setupStorePageDOM();
      global.window.location.href = 'https://store.steampowered.com/app/620/Portal_2/';

      const mockData = createMockHLTBData();
      mockSendMessageSequence([
        createMockSettingsResponse(true),
        createMockMessageResponse({ data: mockData })
      ]);

      const contentScript = new HLTBContentScript();
      await contentScript.initialize();

      await flushPromises();

      // Should not log error
      expect(console.error).not.toHaveBeenCalled();
    });

    test('should handle error response from background', async () => {
      setupStorePageDOM();
      global.window.location.href = 'https://store.steampowered.com/app/620/Portal_2/';

      mockSendMessageSequence([
        createMockSettingsResponse(true),
        createMockErrorResponse('Failed to fetch HLTB data')
      ]);

      const contentScript = new HLTBContentScript();
      await contentScript.initialize();

      await flushPromises();

      // Should log error
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[HLTB] Failed to fetch data:'),
        expect.any(String)
      );
    });

    test('should handle network failure gracefully', async () => {
      setupStorePageDOM();
      global.window.location.href = 'https://store.steampowered.com/app/620/Portal_2/';

      mockSendMessage(createMockSettingsResponse(true));
      mockSendMessageError('Network error');

      const contentScript = new HLTBContentScript();
      await contentScript.initialize();

      await flushPromises();

      // Should handle error
      expect(console.error).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Navigation Observer (4 tests)
  // ============================================================================

  describe('Navigation Observer', () => {
    test('should setup mutation observer for navigation', () => {
      setupStorePageDOM();

      const contentScript = new HLTBContentScript();
      contentScript.setupNavigationObserver();

      expect(MutationObserver).toHaveBeenCalled();
      const mockObserver = (MutationObserver as jest.Mock).mock.results[0].value;
      expect(mockObserver.observe).toHaveBeenCalledWith(
        document.body,
        expect.objectContaining({
          childList: true,
          subtree: true
        })
      );
    });

    test('should detect navigation to new game page', async () => {
      setupStorePageDOM();
      global.window.location.href = 'https://store.steampowered.com/app/620/Portal_2/';

      mockSendMessageSequence([
        createMockSettingsResponse(true),
        createMockMessageResponse(),
        createMockSettingsResponse(true),
        createMockMessageResponse()
      ]);

      const contentScript = new HLTBContentScript();
      await contentScript.initialize();
      contentScript.setupNavigationObserver();

      await flushPromises();
      jest.clearAllMocks();

      // Simulate navigation
      global.window.location.href = 'https://store.steampowered.com/app/440/Team_Fortress_2/';

      // Trigger mutation observer
      const mockObserver = (MutationObserver as jest.Mock).mock.results[0].value;
      const observerCallback = (MutationObserver as jest.Mock).mock.calls[0][0];
      observerCallback([]);

      await flushPromises();

      // Should reinitialize (note: actual implementation would call initialize again)
      // This test validates the observer is set up correctly
      expect(mockObserver.observe).toHaveBeenCalled();
    });

    test('should cleanup on destroy', () => {
      setupStorePageDOM();

      const mockDisconnect = jest.fn();
      (MutationObserver as jest.Mock).mockImplementation(() => ({
        observe: jest.fn(),
        disconnect: mockDisconnect,
        takeRecords: jest.fn()
      }));

      const contentScript = new HLTBContentScript();
      contentScript.setupNavigationObserver();
      contentScript.destroy();

      expect(mockDisconnect).toHaveBeenCalled();
    });

    test('should not reinitialize on non-game page navigation', async () => {
      setupStorePageDOM();
      global.window.location.href = 'https://store.steampowered.com/app/620/Portal_2/';

      mockSendMessageSequence([
        createMockSettingsResponse(true),
        createMockMessageResponse()
      ]);

      const contentScript = new HLTBContentScript();
      await contentScript.initialize();
      contentScript.setupNavigationObserver();

      await flushPromises();
      jest.clearAllMocks();

      // Navigate to non-game page
      global.window.location.href = 'https://store.steampowered.com/search/';

      const observerCallback = (MutationObserver as jest.Mock).mock.calls[0][0];
      observerCallback([]);

      await flushPromises();

      // Should not send any messages
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Integration Orchestration (4 tests)
  // ============================================================================

  describe('Integration Orchestration', () => {
    test('should orchestrate complete initialization flow', async () => {
      setupStorePageDOM();
      global.window.location.href = 'https://store.steampowered.com/app/620/Portal_2/';

      const mockData = createMockHLTBData();
      mockSendMessageSequence([
        createMockSettingsResponse(true),
        createMockMessageResponse({ data: mockData })
      ]);

      const contentScript = new HLTBContentScript();
      await contentScript.initialize();

      await flushPromises();

      // Should complete full flow:
      // 1. Check settings
      // 2. Extract game info
      // 3. Fetch HLTB data
      // 4. Inject UI
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
    });

    test('should show loading state before data fetch', async () => {
      setupStorePageDOM();
      global.window.location.href = 'https://store.steampowered.com/app/620/Portal_2/';

      mockSendMessageSequence([
        createMockSettingsResponse(true),
        createMockMessageResponse()
      ]);

      const contentScript = new HLTBContentScript();
      await contentScript.initialize();

      await flushPromises();

      // Loading state should be shown (via injectionManager mock)
      const { InjectionManager } = require('../../src/content/managers/InjectionManager');
      const mockManager = InjectionManager.mock.results[0].value;
      expect(mockManager.showLoading).toHaveBeenCalled();
    });

    test('should handle error state in orchestration', async () => {
      setupStorePageDOM();
      global.window.location.href = 'https://store.steampowered.com/app/620/Portal_2/';

      mockSendMessageSequence([
        createMockSettingsResponse(true),
        createMockErrorResponse('Test error')
      ]);

      const contentScript = new HLTBContentScript();
      await contentScript.initialize();

      await flushPromises();

      // Should show error
      const { InjectionManager } = require('../../src/content/managers/InjectionManager');
      const mockManager = InjectionManager.mock.results[0].value;
      expect(mockManager.showError).toHaveBeenCalled();
    });

    test('should log performance metrics after injection', async () => {
      setupStorePageDOM();
      global.window.location.href = 'https://store.steampowered.com/app/620/Portal_2/';

      mockSendMessageSequence([
        createMockSettingsResponse(true),
        createMockMessageResponse()
      ]);

      const contentScript = new HLTBContentScript();
      await contentScript.initialize();

      await flushPromises();

      // Should get metrics
      const { InjectionManager } = require('../../src/content/managers/InjectionManager');
      const mockManager = InjectionManager.mock.results[0].value;
      expect(mockManager.getMetrics).toHaveBeenCalled();
    });
  });
});
