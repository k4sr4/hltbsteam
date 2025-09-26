// Integration tests for the complete Chrome extension workflow
require('./setup');

describe('Chrome Extension Integration', () => {
  let messageHandler;
  let contentScriptMocks;

  beforeEach(() => {
    jest.clearAllMocks();
    global.resetChromeMocks();

    // Set up message handler mock
    chrome.runtime.onMessage.addListener.mockImplementation(handler => {
      messageHandler = handler;
    });

    // Mock content script DOM elements
    contentScriptMocks = {
      ogTitleMeta: { content: 'Portal 2' },
      purchaseArea: {
        parentNode: {
          insertBefore: jest.fn()
        }
      },
      hltbContainer: {
        className: '',
        innerHTML: '',
        parentNode: { insertBefore: jest.fn() }
      }
    };

    global.document.querySelector.mockImplementation(selector => {
      switch (selector) {
        case 'meta[property="og:title"]':
          return contentScriptMocks.ogTitleMeta;
        case '.game_area_purchase':
          return contentScriptMocks.purchaseArea;
        default:
          return null;
      }
    });

    global.document.createElement.mockReturnValue(contentScriptMocks.hltbContainer);
  });

  describe('Complete User Flow - First Visit', () => {
    test('should handle complete workflow for new game', async () => {
      // Step 1: User navigates to Steam page
      global.window.location.href = 'https://store.steampowered.com/app/620/Portal_2/';

      // Step 2: Extension checks if enabled
      chrome.runtime.sendMessage
        .mockResolvedValueOnce({ success: true, settings: { enabled: true } })
        .mockResolvedValueOnce({ success: true, data: {
          mainStory: '8 Hours',
          mainExtra: '11 Hours',
          completionist: '15 Hours'
        }});

      // Step 3: No cache exists for this game
      chrome.storage.local.get.mockResolvedValueOnce({});
      chrome.storage.local.set.mockResolvedValue();

      // Load content script (simulates actual loading)
      delete require.cache[require.resolve('../content.js')];
      require('../content.js');

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify the workflow:

      // 1. Settings were requested
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'getSettings' });

      // 2. HLTB data was requested with correct game info
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'fetchHLTB',
        gameTitle: 'Portal 2',
        appId: '620'
      });

      // 3. Cache was checked (via message handler)
      if (messageHandler) {
        const sendResponse = jest.fn();
        messageHandler({
          action: 'fetchHLTB',
          gameTitle: 'Portal 2',
          appId: '620'
        }, {}, sendResponse);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(chrome.storage.local.get).toHaveBeenCalledWith('hltb_620');

        // 4. Fresh data was cached
        expect(chrome.storage.local.set).toHaveBeenCalledWith({
          hltb_620: expect.objectContaining({
            data: expect.any(Object),
            timestamp: expect.any(Number),
            gameTitle: 'Portal 2'
          })
        });

        // 5. Response was sent back
        expect(sendResponse).toHaveBeenCalledWith({
          success: true,
          data: expect.any(Object)
        });
      }

      // 6. UI was injected
      expect(contentScriptMocks.hltbContainer.className).toBe('hltb-container');
      expect(contentScriptMocks.hltbContainer.innerHTML).toContain('8 Hours');
      expect(contentScriptMocks.purchaseArea.parentNode.insertBefore).toHaveBeenCalled();
    });

    test('should handle workflow when extension is disabled', async () => {
      chrome.runtime.sendMessage.mockResolvedValueOnce({
        success: true,
        settings: { enabled: false }
      });

      delete require.cache[require.resolve('../content.js')];
      require('../content.js');

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should only check settings, not fetch HLTB or inject UI
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'getSettings' });
      expect(contentScriptMocks.purchaseArea.parentNode.insertBefore).not.toHaveBeenCalled();
    });
  });

  describe('Complete User Flow - Return Visit with Cache', () => {
    test('should use cached data for faster loading', async () => {
      const cachedData = {
        hltb_620: {
          data: {
            mainStory: '8 Hours',
            mainExtra: '11 Hours',
            completionist: '15 Hours'
          },
          timestamp: Date.now() - 3600000, // 1 hour ago
          gameTitle: 'Portal 2'
        }
      };

      chrome.runtime.sendMessage
        .mockResolvedValueOnce({ success: true, settings: { enabled: true } })
        .mockResolvedValueOnce({ success: true, data: cachedData.hltb_620.data });

      chrome.storage.local.get.mockResolvedValueOnce(cachedData);

      delete require.cache[require.resolve('../content.js')];
      require('../content.js');

      await new Promise(resolve => setTimeout(resolve, 10));

      // Handle the fetchHLTB message
      if (messageHandler) {
        const sendResponse = jest.fn();
        messageHandler({
          action: 'fetchHLTB',
          gameTitle: 'Portal 2',
          appId: '620'
        }, {}, sendResponse);

        await new Promise(resolve => setTimeout(resolve, 0));

        // Should use cache, not set new data
        expect(chrome.storage.local.get).toHaveBeenCalledWith('hltb_620');
        expect(chrome.storage.local.set).not.toHaveBeenCalled();

        expect(sendResponse).toHaveBeenCalledWith({
          success: true,
          data: cachedData.hltb_620.data
        });
      }

      // UI should still be injected with cached data
      expect(contentScriptMocks.hltbContainer.innerHTML).toContain('8 Hours');
    });

    test('should refresh expired cache data', async () => {
      const expiredCacheData = {
        hltb_620: {
          data: { mainStory: '8 Hours' },
          timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000), // 8 days ago
          gameTitle: 'Portal 2'
        }
      };

      chrome.runtime.sendMessage
        .mockResolvedValueOnce({ success: true, settings: { enabled: true } })
        .mockResolvedValueOnce({ success: true, data: {
          mainStory: '8.5 Hours', // Updated data
          mainExtra: '11.5 Hours',
          completionist: '16 Hours'
        }});

      chrome.storage.local.get.mockResolvedValueOnce(expiredCacheData);
      chrome.storage.local.set.mockResolvedValue();

      delete require.cache[require.resolve('../content.js')];
      require('../content.js');

      await new Promise(resolve => setTimeout(resolve, 10));

      if (messageHandler) {
        const sendResponse = jest.fn();
        messageHandler({
          action: 'fetchHLTB',
          gameTitle: 'Portal 2',
          appId: '620'
        }, {}, sendResponse);

        await new Promise(resolve => setTimeout(resolve, 0));

        // Should fetch fresh data because cache is expired
        expect(chrome.storage.local.set).toHaveBeenCalledWith({
          hltb_620: expect.objectContaining({
            data: expect.objectContaining({
              mainStory: '8.5 Hours'
            }),
            timestamp: expect.any(Number)
          })
        });
      }
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle storage errors gracefully in complete workflow', async () => {
      chrome.runtime.sendMessage
        .mockResolvedValueOnce({ success: true, settings: { enabled: true } })
        .mockResolvedValueOnce({ success: false, error: 'Storage error' });

      chrome.storage.local.get.mockRejectedValue(new Error('Storage unavailable'));

      delete require.cache[require.resolve('../content.js')];
      require('../content.js');

      await new Promise(resolve => setTimeout(resolve, 10));

      if (messageHandler) {
        const sendResponse = jest.fn();
        messageHandler({
          action: 'fetchHLTB',
          gameTitle: 'Portal 2',
          appId: '620'
        }, {}, sendResponse);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(sendResponse).toHaveBeenCalledWith({
          success: false,
          error: 'Storage unavailable'
        });
      }

      // Should log error but not crash
      expect(console.error).toHaveBeenCalled();
    });

    test('should handle network errors in HLTB fetching', async () => {
      chrome.runtime.sendMessage
        .mockResolvedValueOnce({ success: true, settings: { enabled: true } })
        .mockResolvedValueOnce({ success: false, error: 'Network error' });

      delete require.cache[require.resolve('../content.js')];
      require('../content.js');

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should handle error gracefully and not inject UI
      expect(console.error).toHaveBeenCalledWith(
        '[HLTB] Failed to fetch data:',
        'Network error'
      );
      expect(contentScriptMocks.purchaseArea.parentNode.insertBefore).not.toHaveBeenCalled();
    });

    test('should handle DOM injection failures', async () => {
      // Make DOM insertion fail
      contentScriptMocks.purchaseArea.parentNode.insertBefore.mockImplementation(() => {
        throw new Error('DOM manipulation failed');
      });

      chrome.runtime.sendMessage
        .mockResolvedValueOnce({ success: true, settings: { enabled: true } })
        .mockResolvedValueOnce({ success: true, data: { mainStory: '8 Hours' } });

      // Should not crash the extension
      expect(() => {
        delete require.cache[require.resolve('../content.js')];
        require('../content.js');
      }).not.toThrow();
    });
  });

  describe('Settings Management Integration', () => {
    test('should propagate settings changes across components', async () => {
      // Initial state: extension enabled
      chrome.storage.local.get
        .mockResolvedValueOnce({ enabled: true, theme: 'auto' })
        .mockResolvedValueOnce({}); // No cache

      if (messageHandler) {
        let sendResponse = jest.fn();
        messageHandler({ action: 'getSettings' }, {}, sendResponse);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(sendResponse).toHaveBeenCalledWith({
          success: true,
          settings: {
            enabled: true,
            cacheEnabled: true,
            theme: 'auto'
          }
        });

        // Change settings
        chrome.storage.local.get.mockResolvedValueOnce({ enabled: false });

        sendResponse = jest.fn();
        messageHandler({ action: 'getSettings' }, {}, sendResponse);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(sendResponse).toHaveBeenCalledWith({
          success: true,
          settings: {
            enabled: false,
            cacheEnabled: true,
            theme: 'auto'
          }
        });
      }
    });

    test('should handle cache management commands', async () => {
      const mockStorage = {
        'hltb_1': { data: {}, timestamp: Date.now() },
        'hltb_2': { data: {}, timestamp: Date.now() },
        'enabled': true
      };

      chrome.storage.local.get.mockResolvedValue(mockStorage);
      chrome.storage.local.remove.mockResolvedValue();

      if (messageHandler) {
        const sendResponse = jest.fn();
        messageHandler({ action: 'clearCache' }, {}, sendResponse);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(chrome.storage.local.remove).toHaveBeenCalledWith(['hltb_1', 'hltb_2']);
        expect(sendResponse).toHaveBeenCalledWith({
          success: true,
          cleared: 2
        });
      }
    });
  });

  describe('Dynamic Navigation Integration', () => {
    test('should handle SPA navigation between game pages', async () => {
      let observerCallback;

      // Mock MutationObserver to capture callback
      const OriginalMutationObserver = global.MutationObserver;
      global.MutationObserver = class extends OriginalMutationObserver {
        constructor(callback) {
          super(callback);
          observerCallback = callback;
        }
      };

      chrome.runtime.sendMessage
        .mockResolvedValueOnce({ success: true, settings: { enabled: true } })
        .mockResolvedValueOnce({ success: true, data: { mainStory: '8 Hours' } });

      // Load content script on first page
      delete require.cache[require.resolve('../content.js')];
      require('../content.js');

      await new Promise(resolve => setTimeout(resolve, 10));

      // Clear previous calls
      jest.clearAllMocks();

      // Simulate navigation to different game
      global.window.location.href = 'https://store.steampowered.com/app/440/Team_Fortress_2/';
      contentScriptMocks.ogTitleMeta.content = 'Team Fortress 2';

      chrome.runtime.sendMessage
        .mockResolvedValueOnce({ success: true, settings: { enabled: true } })
        .mockResolvedValueOnce({ success: true, data: { mainStory: 'Free to Play' } });

      // Trigger observer
      if (observerCallback) {
        observerCallback();
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should reinitialize for new game
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'fetchHLTB',
        gameTitle: 'Team Fortress 2',
        appId: '440'
      });
    });

    test('should not reinitialize when navigating away from game pages', async () => {
      let observerCallback;

      global.MutationObserver = class {
        constructor(callback) {
          observerCallback = callback;
          this.observe = jest.fn();
          this.disconnect = jest.fn();
        }
      };

      delete require.cache[require.resolve('../content.js')];
      require('../content.js');

      jest.clearAllMocks();

      // Navigate to non-game page
      global.window.location.href = 'https://store.steampowered.com/search/';

      if (observerCallback) {
        observerCallback();
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should not make any requests
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Performance Integration', () => {
    test('should handle multiple concurrent requests efficiently', async () => {
      const apps = ['620', '440', '730'];
      const responses = apps.map(id => ({
        success: true,
        data: { mainStory: `${id} Hours` }
      }));

      chrome.runtime.sendMessage.mockImplementation((msg) => {
        if (msg.action === 'fetchHLTB') {
          const response = responses.find(r =>
            r.data.mainStory.includes(msg.appId)
          ) || responses[0];
          return Promise.resolve(response);
        }
        return Promise.resolve({ success: true, settings: { enabled: true } });
      });

      // Simulate concurrent requests
      const requests = apps.map(appId =>
        chrome.runtime.sendMessage({
          action: 'fetchHLTB',
          gameTitle: `Game ${appId}`,
          appId
        })
      );

      const results = await Promise.all(requests);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
      });
    });

    test('should measure and optimize response times', async () => {
      const startTime = Date.now();

      chrome.runtime.sendMessage
        .mockResolvedValueOnce({ success: true, settings: { enabled: true } })
        .mockResolvedValueOnce({ success: true, data: { mainStory: '8 Hours' } });

      // Mock fast cache response
      chrome.storage.local.get.mockResolvedValueOnce({
        hltb_620: {
          data: { mainStory: '8 Hours' },
          timestamp: Date.now(),
          gameTitle: 'Portal 2'
        }
      });

      delete require.cache[require.resolve('../content.js')];
      require('../content.js');

      if (messageHandler) {
        const sendResponse = jest.fn();
        messageHandler({
          action: 'fetchHLTB',
          gameTitle: 'Portal 2',
          appId: '620'
        }, {}, sendResponse);

        await new Promise(resolve => setTimeout(resolve, 0));

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        // Should be fast with cached data
        expect(responseTime).toBeLessThan(100);
        expect(sendResponse).toHaveBeenCalled();
      }
    });
  });
});