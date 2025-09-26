// Tests for background.js service worker
require('./setup');

// Import the background script
// Note: In a real setup, you'd use babel-jest to transform the imports
let messageListenerCallback;
let alarmListenerCallback;
let installedListenerCallback;

beforeEach(() => {
  jest.clearAllMocks();
  global.resetChromeMocks();

  // Capture the listeners when they're registered
  chrome.runtime.onMessage.addListener.mockImplementation((callback) => {
    messageListenerCallback = callback;
  });

  chrome.alarms.onAlarm.addListener.mockImplementation((callback) => {
    alarmListenerCallback = callback;
  });

  chrome.runtime.onInstalled.addListener.mockImplementation((callback) => {
    installedListenerCallback = callback;
  });

  // Load the background script
  require('../background.js');
});

describe('Background Service Worker', () => {
  describe('Message Handling', () => {
    test('should register message listener on startup', () => {
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
      expect(messageListenerCallback).toBeDefined();
    });

    describe('fetchHLTB action', () => {
      test('should return cached data when available and not expired', async () => {
        const mockCache = {
          hltb_123456: {
            data: { mainStory: '10 Hours', mainExtra: '20 Hours', completionist: '40 Hours' },
            timestamp: Date.now(),
            gameTitle: 'Test Game'
          }
        };

        chrome.storage.local.get.mockResolvedValue(mockCache);

        const sendResponse = jest.fn();
        const request = {
          action: 'fetchHLTB',
          gameTitle: 'Test Game',
          appId: '123456'
        };

        const willRespond = messageListenerCallback(request, {}, sendResponse);
        expect(willRespond).toBe(true); // Indicates async response

        // Wait for async operations
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(chrome.storage.local.get).toHaveBeenCalledWith('hltb_123456');
        expect(sendResponse).toHaveBeenCalledWith({
          success: true,
          data: mockCache.hltb_123456.data
        });
      });

      test('should fetch fresh data when cache is expired', async () => {
        const mockCache = {
          hltb_123456: {
            data: { mainStory: '10 Hours' },
            timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000), // 8 days old
            gameTitle: 'Test Game'
          }
        };

        chrome.storage.local.get.mockResolvedValue(mockCache);
        chrome.storage.local.set.mockResolvedValue();

        const sendResponse = jest.fn();
        const request = {
          action: 'fetchHLTB',
          gameTitle: 'Test Game',
          appId: '123456'
        };

        messageListenerCallback(request, {}, sendResponse);

        await new Promise(resolve => setTimeout(resolve, 0));

        // Should set new cache data
        expect(chrome.storage.local.set).toHaveBeenCalled();

        // Should respond with fresh data
        expect(sendResponse).toHaveBeenCalledWith({
          success: true,
          data: expect.objectContaining({
            mainStory: expect.any(String),
            mainExtra: expect.any(String),
            completionist: expect.any(String)
          })
        });
      });

      test('should fetch fresh data when no cache exists', async () => {
        chrome.storage.local.get.mockResolvedValue({});
        chrome.storage.local.set.mockResolvedValue();

        const sendResponse = jest.fn();
        const request = {
          action: 'fetchHLTB',
          gameTitle: 'New Game',
          appId: '789012'
        };

        messageListenerCallback(request, {}, sendResponse);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(chrome.storage.local.set).toHaveBeenCalledWith({
          hltb_789012: expect.objectContaining({
            data: expect.any(Object),
            timestamp: expect.any(Number),
            gameTitle: 'New Game'
          })
        });

        expect(sendResponse).toHaveBeenCalledWith({
          success: true,
          data: expect.any(Object)
        });
      });

      test('should handle errors gracefully', async () => {
        chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

        const sendResponse = jest.fn();
        const request = {
          action: 'fetchHLTB',
          gameTitle: 'Test Game',
          appId: '123456'
        };

        messageListenerCallback(request, {}, sendResponse);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(sendResponse).toHaveBeenCalledWith({
          success: false,
          error: 'Storage error'
        });
      });
    });

    describe('getSettings action', () => {
      test('should return default settings when none are stored', async () => {
        chrome.storage.local.get.mockResolvedValue({});

        const sendResponse = jest.fn();
        const request = { action: 'getSettings' };

        messageListenerCallback(request, {}, sendResponse);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(sendResponse).toHaveBeenCalledWith({
          success: true,
          settings: {
            enabled: true,
            cacheEnabled: true,
            theme: 'auto'
          }
        });
      });

      test('should return stored settings', async () => {
        chrome.storage.local.get.mockResolvedValue({
          enabled: false,
          cacheEnabled: true,
          theme: 'dark'
        });

        const sendResponse = jest.fn();
        const request = { action: 'getSettings' };

        messageListenerCallback(request, {}, sendResponse);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(sendResponse).toHaveBeenCalledWith({
          success: true,
          settings: {
            enabled: false,
            cacheEnabled: true,
            theme: 'dark'
          }
        });
      });

      test('should handle settings retrieval errors', async () => {
        chrome.storage.local.get.mockRejectedValue(new Error('Settings error'));

        const sendResponse = jest.fn();
        const request = { action: 'getSettings' };

        messageListenerCallback(request, {}, sendResponse);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(sendResponse).toHaveBeenCalledWith({
          success: false,
          error: 'Settings error'
        });
      });
    });

    describe('clearCache action', () => {
      test('should remove all cache entries', async () => {
        const mockStorage = {
          hltb_123: { data: {} },
          hltb_456: { data: {} },
          enabled: true,
          theme: 'dark'
        };

        chrome.storage.local.get.mockResolvedValue(mockStorage);
        chrome.storage.local.remove.mockResolvedValue();

        const sendResponse = jest.fn();
        const request = { action: 'clearCache' };

        messageListenerCallback(request, {}, sendResponse);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(chrome.storage.local.remove).toHaveBeenCalledWith(['hltb_123', 'hltb_456']);
        expect(sendResponse).toHaveBeenCalledWith({
          success: true,
          cleared: 2
        });
      });

      test('should handle empty cache', async () => {
        chrome.storage.local.get.mockResolvedValue({
          enabled: true,
          theme: 'light'
        });
        chrome.storage.local.remove.mockResolvedValue();

        const sendResponse = jest.fn();
        const request = { action: 'clearCache' };

        messageListenerCallback(request, {}, sendResponse);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(chrome.storage.local.remove).toHaveBeenCalledWith([]);
        expect(sendResponse).toHaveBeenCalledWith({
          success: true,
          cleared: 0
        });
      });

      test('should handle cache clearing errors', async () => {
        chrome.storage.local.get.mockRejectedValue(new Error('Clear error'));

        const sendResponse = jest.fn();
        const request = { action: 'clearCache' };

        messageListenerCallback(request, {}, sendResponse);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(sendResponse).toHaveBeenCalledWith({
          success: false,
          error: 'Clear error'
        });
      });
    });

    test('should handle unknown actions', () => {
      const sendResponse = jest.fn();
      const request = { action: 'unknownAction' };

      const result = messageListenerCallback(request, {}, sendResponse);

      expect(result).toBeUndefined(); // Synchronous response
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Unknown action'
      });
    });
  });

  describe('Cache Management', () => {
    test('should set up periodic cache cleanup alarm on load', () => {
      // Clear previous calls and reload the background script to test alarm setup
      chrome.alarms.create.mockClear();
      delete require.cache[require.resolve('../background.js')];
      require('../background.js');

      expect(chrome.alarms.create).toHaveBeenCalledWith(
        'cleanupCache',
        { periodInMinutes: 60 }
      );
    });

    test('should clean up expired cache entries on alarm', async () => {
      const mockStorage = {
        hltb_old: {
          data: {},
          timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000) // 8 days old
        },
        hltb_new: {
          data: {},
          timestamp: Date.now() // Fresh
        },
        settings: { enabled: true }
      };

      chrome.storage.local.get.mockResolvedValue(mockStorage);
      chrome.storage.local.remove.mockResolvedValue();

      // Trigger the alarm
      alarmListenerCallback({ name: 'cleanupCache' });

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(chrome.storage.local.remove).toHaveBeenCalledWith(['hltb_old']);
    });

    test('should not remove non-expired cache entries', async () => {
      const mockStorage = {
        hltb_recent1: {
          data: {},
          timestamp: Date.now() - (3 * 24 * 60 * 60 * 1000) // 3 days old
        },
        hltb_recent2: {
          data: {},
          timestamp: Date.now() - (1 * 24 * 60 * 60 * 1000) // 1 day old
        }
      };

      chrome.storage.local.get.mockResolvedValue(mockStorage);

      alarmListenerCallback({ name: 'cleanupCache' });

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(chrome.storage.local.remove).not.toHaveBeenCalled();
    });

    test('should ignore non-cleanup alarms', () => {
      alarmListenerCallback({ name: 'otherAlarm' });

      expect(chrome.storage.local.get).not.toHaveBeenCalled();
    });
  });

  describe('Extension Installation', () => {
    test('should set default settings on install', () => {
      chrome.storage.local.set.mockResolvedValue();

      installedListenerCallback({ reason: 'install' });

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        enabled: true,
        cacheEnabled: true,
        theme: 'auto',
        installDate: expect.any(Number)
      });
    });

    test('should not set defaults on update', () => {
      installedListenerCallback({ reason: 'update' });

      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    test('should log installation reason', () => {
      installedListenerCallback({ reason: 'chrome_update' });

      expect(console.log).toHaveBeenCalledWith(
        '[HLTB] Extension installed:',
        'chrome_update'
      );
    });
  });

  describe('Cache Expiration Logic', () => {
    test('should correctly identify expired cache (older than 7 days)', () => {
      const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);
      const sixDaysAgo = Date.now() - (6 * 24 * 60 * 60 * 1000);

      // We need to test the isCacheExpired function
      // Since it's not exported, we'll test it indirectly through fetchHLTB

      chrome.storage.local.get.mockResolvedValueOnce({
        hltb_123: {
          data: { mainStory: '10 Hours' },
          timestamp: eightDaysAgo
        }
      });

      const sendResponse = jest.fn();
      messageListenerCallback(
        { action: 'fetchHLTB', gameTitle: 'Test', appId: '123' },
        {},
        sendResponse
      );

      // If cache was expired, it should try to set new data
      return new Promise(resolve => {
        setTimeout(() => {
          expect(chrome.storage.local.set).toHaveBeenCalled();
          resolve();
        }, 0);
      });
    });
  });
});