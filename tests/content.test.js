// Tests for content.js script
require('./setup');

// Mock functions that will be defined in content.js
let observerInstance;

beforeEach(() => {
  jest.clearAllMocks();
  global.resetChromeMocks();

  // Reset window location
  global.window.location.href = 'https://store.steampowered.com/app/123456/Test_Game/';

  // Reset document state
  global.document.querySelector.mockReset();
  global.document.querySelectorAll.mockReset();
  global.document.createElement.mockReset();

  // Capture MutationObserver instance
  const OriginalMutationObserver = global.MutationObserver;
  global.MutationObserver = class extends OriginalMutationObserver {
    constructor(callback) {
      super(callback);
      observerInstance = this;
    }
  };
});

describe('Content Script', () => {
  describe('Game Page Detection', () => {
    test('should detect Steam store game pages', () => {
      const testUrls = [
        'https://store.steampowered.com/app/730/Counter_Strike_2/',
        'https://store.steampowered.com/app/570/Dota_2/',
        'https://steamcommunity.com/app/440/Portal_2/'
      ];

      testUrls.forEach(url => {
        global.window.location.href = url;
        // Clear module cache to reload content.js with new URL
        delete require.cache[require.resolve('../content.js')];

        chrome.runtime.sendMessage.mockResolvedValue({
          success: true,
          settings: { enabled: true }
        });

        require('../content.js');

        expect(chrome.runtime.sendMessage).toHaveBeenCalled();
      });
    });

    test('should not initialize on non-game pages', () => {
      const nonGameUrls = [
        'https://store.steampowered.com/',
        'https://store.steampowered.com/search/',
        'https://steamcommunity.com/profiles/123456',
        'https://store.steampowered.com/genre/Action/'
      ];

      nonGameUrls.forEach(url => {
        jest.clearAllMocks();
        global.window.location.href = url;
        delete require.cache[require.resolve('../content.js')];

        require('../content.js');

        expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
      });
    });

    test('should handle URL with query parameters and fragments', () => {
      global.window.location.href = 'https://store.steampowered.com/app/123456/Test_Game/?snr=1_7_15__13#comments';
      delete require.cache[require.resolve('../content.js')];

      chrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        settings: { enabled: true }
      });

      require('../content.js');

      expect(chrome.runtime.sendMessage).toHaveBeenCalled();
    });
  });

  describe('Game Info Extraction', () => {
    beforeEach(() => {
      chrome.runtime.sendMessage
        .mockResolvedValueOnce({ success: true, settings: { enabled: true } })
        .mockResolvedValueOnce({
          success: true,
          data: { mainStory: '10 Hours', mainExtra: '20 Hours', completionist: '30 Hours' }
        });
    });

    test('should extract app ID from URL', () => {
      global.window.location.href = 'https://store.steampowered.com/app/987654/Sample_Game/';

      const metaTag = { content: 'Sample Game' };
      global.document.querySelector.mockImplementation(selector => {
        if (selector === 'meta[property="og:title"]') {
          return metaTag;
        }
        return null;
      });

      delete require.cache[require.resolve('../content.js')];
      require('../content.js');

      // Wait for async initialization
      return new Promise(resolve => {
        setTimeout(() => {
          expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
              action: 'fetchHLTB',
              appId: '987654',
              gameTitle: 'Sample Game'
            })
          );
          resolve();
        }, 0);
      });
    });

    test('should extract game title from og:title meta tag', () => {
      const metaTag = { content: 'Portal 2' };
      global.document.querySelector.mockImplementation(selector => {
        if (selector === 'meta[property="og:title"]') {
          return metaTag;
        }
        return null;
      });

      delete require.cache[require.resolve('../content.js')];
      require('../content.js');

      return new Promise(resolve => {
        setTimeout(() => {
          expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
              gameTitle: 'Portal 2'
            })
          );
          resolve();
        }, 0);
      });
    });

    test('should fall back to document title if og:title not found', () => {
      global.document.querySelector.mockReturnValue(null);
      global.document.title = 'Half-Life: Alyx on Steam';

      delete require.cache[require.resolve('../content.js')];
      require('../content.js');

      return new Promise(resolve => {
        setTimeout(() => {
          expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
              gameTitle: 'Half-Life: Alyx'
            })
          );
          resolve();
        }, 0);
      });
    });

    test('should handle missing game info gracefully', () => {
      global.window.location.href = 'https://store.steampowered.com/app/invalid/';
      global.document.querySelector.mockReturnValue(null);
      global.document.title = 'Steam';

      delete require.cache[require.resolve('../content.js')];
      require('../content.js');

      return new Promise(resolve => {
        setTimeout(() => {
          // Should check settings but not fetch HLTB data
          const calls = chrome.runtime.sendMessage.mock.calls;
          expect(calls.some(call => call[0].action === 'getSettings')).toBe(true);
          expect(calls.some(call => call[0].action === 'fetchHLTB')).toBe(false);
          resolve();
        }, 0);
      });
    });
  });

  describe('HLTB Data Injection', () => {
    beforeEach(() => {
      const mockElement = {
        className: '',
        innerHTML: '',
        parentNode: {
          insertBefore: jest.fn()
        }
      };

      global.document.createElement.mockReturnValue(mockElement);
    });

    test('should inject HLTB data into the DOM', () => {
      const purchaseArea = {
        parentNode: {
          insertBefore: jest.fn()
        }
      };

      global.document.querySelector.mockImplementation(selector => {
        if (selector === '.game_area_purchase') {
          return purchaseArea;
        }
        if (selector === 'meta[property="og:title"]') {
          return { content: 'Test Game' };
        }
        return null;
      });

      chrome.runtime.sendMessage
        .mockResolvedValueOnce({ success: true, settings: { enabled: true } })
        .mockResolvedValueOnce({
          success: true,
          data: {
            mainStory: '12 Hours',
            mainExtra: '24 Hours',
            completionist: '48 Hours'
          }
        });

      delete require.cache[require.resolve('../content.js')];
      require('../content.js');

      return new Promise(resolve => {
        setTimeout(() => {
          const createdElement = global.document.createElement.mock.results[0].value;
          expect(createdElement.className).toBe('hltb-container');
          expect(createdElement.innerHTML).toContain('12 Hours');
          expect(createdElement.innerHTML).toContain('24 Hours');
          expect(createdElement.innerHTML).toContain('48 Hours');
          expect(purchaseArea.parentNode.insertBefore).toHaveBeenCalled();
          resolve();
        }, 10);
      });
    });

    test('should handle missing HLTB data gracefully', () => {
      const purchaseArea = {
        parentNode: {
          insertBefore: jest.fn()
        }
      };

      global.document.querySelector.mockImplementation(selector => {
        if (selector === '.game_area_purchase') {
          return purchaseArea;
        }
        if (selector === 'meta[property="og:title"]') {
          return { content: 'Test Game' };
        }
        return null;
      });

      chrome.runtime.sendMessage
        .mockResolvedValueOnce({ success: true, settings: { enabled: true } })
        .mockResolvedValueOnce({
          success: true,
          data: {
            mainStory: null,
            mainExtra: null,
            completionist: null
          }
        });

      delete require.cache[require.resolve('../content.js')];
      require('../content.js');

      return new Promise(resolve => {
        setTimeout(() => {
          const createdElement = global.document.createElement.mock.results[0].value;
          expect(createdElement.innerHTML).toContain('N/A');
          resolve();
        }, 10);
      });
    });

    test('should handle missing injection point', () => {
      global.document.querySelector.mockReturnValue(null);

      chrome.runtime.sendMessage
        .mockResolvedValueOnce({ success: true, settings: { enabled: true } })
        .mockResolvedValueOnce({
          success: true,
          data: { mainStory: '10 Hours' }
        });

      // Should not throw error even if injection point not found
      expect(() => {
        delete require.cache[require.resolve('../content.js')];
        require('../content.js');
      }).not.toThrow();
    });
  });

  describe('Extension State Management', () => {
    test('should not initialize when extension is disabled', () => {
      chrome.runtime.sendMessage.mockResolvedValueOnce({
        success: true,
        settings: { enabled: false }
      });

      delete require.cache[require.resolve('../content.js')];
      require('../content.js');

      return new Promise(resolve => {
        setTimeout(() => {
          // Should only call getSettings, not fetchHLTB
          expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
          expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'getSettings' });
          resolve();
        }, 0);
      });
    });

    test('should handle settings fetch failure', () => {
      chrome.runtime.sendMessage.mockResolvedValueOnce({
        success: false,
        error: 'Failed to get settings'
      });

      delete require.cache[require.resolve('../content.js')];
      require('../content.js');

      return new Promise(resolve => {
        setTimeout(() => {
          // Should not proceed to fetch HLTB data
          expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
          resolve();
        }, 0);
      });
    });

    test('should handle HLTB data fetch failure', () => {
      global.document.querySelector.mockImplementation(selector => {
        if (selector === 'meta[property="og:title"]') {
          return { content: 'Test Game' };
        }
        return null;
      });

      chrome.runtime.sendMessage
        .mockResolvedValueOnce({ success: true, settings: { enabled: true } })
        .mockResolvedValueOnce({
          success: false,
          error: 'Failed to fetch HLTB data'
        });

      delete require.cache[require.resolve('../content.js')];
      require('../content.js');

      return new Promise(resolve => {
        setTimeout(() => {
          // Should not crash and should log error
          expect(console.error).toHaveBeenCalledWith(
            '[HLTB] Failed to fetch data:',
            'Failed to fetch HLTB data'
          );
          resolve();
        }, 0);
      });
    });
  });

  describe('Dynamic Navigation Handling', () => {
    test('should set up MutationObserver for SPA navigation', () => {
      delete require.cache[require.resolve('../content.js')];
      require('../content.js');

      expect(observerInstance).toBeDefined();
      expect(observerInstance.observe).toHaveBeenCalledWith(
        global.document.body,
        {
          childList: true,
          subtree: true
        }
      );
    });

    test('should reinitialize on navigation to game page', () => {
      chrome.runtime.sendMessage
        .mockResolvedValueOnce({ success: true, settings: { enabled: true } })
        .mockResolvedValueOnce({ success: true, data: {} });

      delete require.cache[require.resolve('../content.js')];
      require('../content.js');

      // Clear previous calls
      chrome.runtime.sendMessage.mockClear();

      // Simulate navigation to a new game page
      global.window.location.href = 'https://store.steampowered.com/app/999999/New_Game/';

      chrome.runtime.sendMessage
        .mockResolvedValueOnce({ success: true, settings: { enabled: true } })
        .mockResolvedValueOnce({ success: true, data: {} });

      // Trigger the mutation observer callback
      if (observerInstance && observerInstance.callback) {
        observerInstance.callback();
      }

      return new Promise(resolve => {
        setTimeout(() => {
          // Should reinitialize extension
          expect(chrome.runtime.sendMessage).toHaveBeenCalled();
          resolve();
        }, 0);
      });
    });

    test('should not reinitialize when navigating to non-game page', () => {
      delete require.cache[require.resolve('../content.js')];
      require('../content.js');

      chrome.runtime.sendMessage.mockClear();

      // Simulate navigation to non-game page
      global.window.location.href = 'https://store.steampowered.com/search/';

      if (observerInstance && observerInstance.callback) {
        observerInstance.callback();
      }

      return new Promise(resolve => {
        setTimeout(() => {
          // Should not call sendMessage
          expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
          resolve();
        }, 0);
      });
    });

    test('should not reinitialize when URL does not change', () => {
      delete require.cache[require.resolve('../content.js')];
      require('../content.js');

      chrome.runtime.sendMessage.mockClear();

      // Trigger mutation without URL change
      if (observerInstance && observerInstance.callback) {
        observerInstance.callback();
      }

      return new Promise(resolve => {
        setTimeout(() => {
          expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
          resolve();
        }, 0);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle chrome.runtime.sendMessage rejection', () => {
      chrome.runtime.sendMessage.mockRejectedValue(new Error('Runtime error'));

      global.document.querySelector.mockImplementation(selector => {
        if (selector === 'meta[property="og:title"]') {
          return { content: 'Test Game' };
        }
        return null;
      });

      delete require.cache[require.resolve('../content.js')];
      require('../content.js');

      return new Promise(resolve => {
        setTimeout(() => {
          expect(console.error).toHaveBeenCalledWith(
            '[HLTB] Extension error:',
            expect.any(Error)
          );
          resolve();
        }, 0);
      });
    });

    test('should handle DOM manipulation errors', () => {
      const errorElement = {
        className: '',
        innerHTML: '',
        parentNode: {
          insertBefore: jest.fn().mockImplementation(() => {
            throw new Error('DOM error');
          })
        }
      };

      global.document.createElement.mockReturnValue(errorElement);
      global.document.querySelector.mockImplementation(selector => {
        if (selector === '.game_area_purchase') {
          return errorElement;
        }
        if (selector === 'meta[property="og:title"]') {
          return { content: 'Test Game' };
        }
        return null;
      });

      chrome.runtime.sendMessage
        .mockResolvedValueOnce({ success: true, settings: { enabled: true } })
        .mockResolvedValueOnce({ success: true, data: { mainStory: '10 Hours' } });

      // Should handle error gracefully
      expect(() => {
        delete require.cache[require.resolve('../content.js')];
        require('../content.js');
      }).not.toThrow();
    });
  });
});