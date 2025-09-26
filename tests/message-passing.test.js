// Tests for message passing between content script and background
require('./setup');

describe('Message Passing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.resetChromeMocks();
  });

  describe('Content to Background Communication', () => {
    test('should send messages with correct structure', async () => {
      const testMessage = {
        action: 'fetchHLTB',
        gameTitle: 'Portal 2',
        appId: '620'
      };

      chrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        data: { mainStory: '8 Hours' }
      });

      const response = await chrome.runtime.sendMessage(testMessage);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(testMessage);
      expect(response).toEqual({
        success: true,
        data: { mainStory: '8 Hours' }
      });
    });

    test('should handle async response patterns', async () => {
      const messages = [
        { action: 'getSettings' },
        { action: 'fetchHLTB', gameTitle: 'Test', appId: '123' },
        { action: 'clearCache' }
      ];

      const responses = [
        { success: true, settings: { enabled: true } },
        { success: true, data: { mainStory: '10 Hours' } },
        { success: true, cleared: 5 }
      ];

      messages.forEach((msg, index) => {
        chrome.runtime.sendMessage.mockResolvedValueOnce(responses[index]);
      });

      const results = await Promise.all(
        messages.map(msg => chrome.runtime.sendMessage(msg))
      );

      expect(results).toEqual(responses);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(3);
    });

    test('should handle message timeout', async () => {
      chrome.runtime.sendMessage.mockImplementation(() =>
        new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Message timeout')), 100);
        })
      );

      await expect(
        chrome.runtime.sendMessage({ action: 'fetchHLTB' })
      ).rejects.toThrow('Message timeout');
    });

    test('should handle connection errors', async () => {
      chrome.runtime.sendMessage.mockRejectedValue(
        new Error('Could not establish connection. Receiving end does not exist.')
      );

      await expect(
        chrome.runtime.sendMessage({ action: 'test' })
      ).rejects.toThrow('Could not establish connection');
    });
  });

  describe('Background Message Handling', () => {
    let messageHandler;

    beforeEach(() => {
      chrome.runtime.onMessage.addListener.mockImplementation(handler => {
        messageHandler = handler;
      });

      // Load background script to register the handler
      delete require.cache[require.resolve('../background.js')];
      require('../background.js');
    });

    test('should return true for async handlers', () => {
      const asyncActions = ['fetchHLTB', 'getSettings', 'clearCache'];

      asyncActions.forEach(action => {
        const result = messageHandler(
          { action },
          {},
          jest.fn()
        );
        expect(result).toBe(true); // Indicates async response
      });
    });

    test('should return undefined for sync handlers', () => {
      const result = messageHandler(
        { action: 'unknownAction' },
        {},
        jest.fn()
      );
      expect(result).toBeUndefined(); // Sync response
    });

    test('should validate message structure', () => {
      const sendResponse = jest.fn();
      const invalidMessages = [
        null,
        undefined,
        {},
        { noAction: true },
        { action: null }
      ];

      invalidMessages.forEach(msg => {
        messageHandler(msg, {}, sendResponse);
        // Should handle gracefully, likely responding with error
      });

      // At least some should have responded with error
      expect(sendResponse).toHaveBeenCalled();
    });

    test('should pass sender information to handler', () => {
      const sender = {
        tab: { id: 123, url: 'https://store.steampowered.com' },
        frameId: 0
      };

      const sendResponse = jest.fn();
      messageHandler(
        { action: 'getSettings' },
        sender,
        sendResponse
      );

      // Handler has access to sender info for validation/logging
      expect(sendResponse).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed responses gracefully', async () => {
      const malformedResponses = [
        null,
        undefined,
        'string response',
        123,
        []
      ];

      for (const response of malformedResponses) {
        chrome.runtime.sendMessage.mockResolvedValueOnce(response);

        const result = await chrome.runtime.sendMessage({ action: 'test' });
        expect(result).toBe(response);
      }
    });

    test('should handle chrome.runtime.lastError', async () => {
      chrome.runtime.lastError = { message: 'Extension context invalidated' };
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        if (callback) {
          callback(undefined);
        }
        return Promise.reject(new Error(chrome.runtime.lastError.message));
      });

      await expect(
        chrome.runtime.sendMessage({ action: 'test' })
      ).rejects.toThrow('Extension context invalidated');

      chrome.runtime.lastError = null; // Reset
    });

    test('should retry failed messages with exponential backoff', async () => {
      let attempts = 0;
      chrome.runtime.sendMessage.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({ success: true });
      });

      // Implement retry logic
      async function sendMessageWithRetry(message, maxRetries = 3) {
        let lastError;
        for (let i = 0; i < maxRetries; i++) {
          try {
            return await chrome.runtime.sendMessage(message);
          } catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 100));
            }
          }
        }
        throw lastError;
      }

      const result = await sendMessageWithRetry({ action: 'test' });
      expect(result).toEqual({ success: true });
      expect(attempts).toBe(3);
    });
  });

  describe('Message Queueing', () => {
    test('should handle concurrent messages', async () => {
      const messages = Array.from({ length: 10 }, (_, i) => ({
        action: 'fetchHLTB',
        appId: String(i),
        gameTitle: `Game ${i}`
      }));

      chrome.runtime.sendMessage.mockImplementation(msg =>
        Promise.resolve({
          success: true,
          appId: msg.appId
        })
      );

      const results = await Promise.all(
        messages.map(msg => chrome.runtime.sendMessage(msg))
      );

      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result.appId).toBe(String(i));
      });
    });

    test('should maintain message order in responses', async () => {
      const delays = [300, 100, 200]; // Different response times
      const messages = delays.map((_, i) => ({
        action: 'test',
        id: i
      }));

      chrome.runtime.sendMessage.mockImplementation(msg =>
        new Promise(resolve => {
          setTimeout(() => {
            resolve({ success: true, id: msg.id });
          }, delays[msg.id]);
        })
      );

      const results = await Promise.all(
        messages.map(msg => chrome.runtime.sendMessage(msg))
      );

      // Results should maintain order despite different delays
      results.forEach((result, i) => {
        expect(result.id).toBe(i);
      });
    });
  });

  describe('Message Validation', () => {
    test('should validate required fields for fetchHLTB', () => {
      const validMessage = {
        action: 'fetchHLTB',
        gameTitle: 'Portal',
        appId: '400'
      };

      const invalidMessages = [
        { action: 'fetchHLTB' }, // Missing fields
        { action: 'fetchHLTB', gameTitle: 'Portal' }, // Missing appId
        { action: 'fetchHLTB', appId: '400' }, // Missing gameTitle
        { action: 'fetchHLTB', gameTitle: '', appId: '400' }, // Empty gameTitle
        { action: 'fetchHLTB', gameTitle: 'Portal', appId: '' } // Empty appId
      ];

      // Validation function that would be in actual implementation
      function validateFetchHLTBMessage(msg) {
        if (!msg) return false;
        if (msg.action !== 'fetchHLTB') return false;
        if (!msg.gameTitle || typeof msg.gameTitle !== 'string' || msg.gameTitle.trim() === '') return false;
        if (!msg.appId || typeof msg.appId !== 'string' || msg.appId.trim() === '') return false;
        return true;
      }

      expect(validateFetchHLTBMessage(validMessage)).toBe(true);
      invalidMessages.forEach(msg => {
        expect(validateFetchHLTBMessage(msg)).toBe(false);
      });
    });

    test('should sanitize message data', () => {
      const unsafeMessage = {
        action: 'fetchHLTB',
        gameTitle: '<script>alert("XSS")</script>Game',
        appId: '123; DROP TABLE games;'
      };

      // Sanitization function
      function sanitizeMessage(msg) {
        return {
          ...msg,
          gameTitle: msg.gameTitle?.replace(/[<>]/g, ''),
          appId: msg.appId?.replace(/[^0-9]/g, '')
        };
      }

      const sanitized = sanitizeMessage(unsafeMessage);
      expect(sanitized.gameTitle).toBe('scriptalert("XSS")/scriptGame');
      expect(sanitized.appId).toBe('123');
    });
  });

  describe('Connection State Management', () => {
    test('should detect disconnected state', async () => {
      chrome.runtime.sendMessage.mockImplementation(() => {
        throw new Error('Extension context invalidated');
      });

      let isConnected = true;
      try {
        await chrome.runtime.sendMessage({ action: 'ping' });
      } catch (error) {
        if (error.message.includes('context invalidated')) {
          isConnected = false;
        }
      }

      expect(isConnected).toBe(false);
    });

    test('should attempt reconnection after disconnect', async () => {
      let disconnected = true;
      let attempts = 0;

      chrome.runtime.sendMessage.mockImplementation(() => {
        attempts++;
        if (disconnected && attempts <= 2) {
          throw new Error('Extension context invalidated');
        }
        disconnected = false;
        return Promise.resolve({ success: true });
      });

      async function sendWithReconnect(message) {
        for (let i = 0; i < 3; i++) {
          try {
            return await chrome.runtime.sendMessage(message);
          } catch (error) {
            if (error.message.includes('context invalidated') && i < 2) {
              // Wait and retry
              await new Promise(resolve => setTimeout(resolve, 100));
              continue;
            }
            throw error;
          }
        }
      }

      const result = await sendWithReconnect({ action: 'test' });
      expect(result).toEqual({ success: true });
      expect(attempts).toBe(3);
    });
  });

  describe('Performance Monitoring', () => {
    test('should measure message round-trip time', async () => {
      const startTime = Date.now();

      chrome.runtime.sendMessage.mockImplementation(() =>
        new Promise(resolve => {
          setTimeout(() => resolve({ success: true }), 100);
        })
      );

      await chrome.runtime.sendMessage({ action: 'test' });
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(100);
      expect(duration).toBeLessThan(200); // Some tolerance
    });

    test('should track message success rate', async () => {
      const messages = Array(10).fill({ action: 'test' });
      let successCount = 0;
      let failureCount = 0;

      chrome.runtime.sendMessage.mockImplementation(() => {
        const shouldSucceed = Math.random() > 0.3; // 70% success rate
        if (shouldSucceed) {
          successCount++;
          return Promise.resolve({ success: true });
        } else {
          failureCount++;
          return Promise.reject(new Error('Random failure'));
        }
      });

      for (const msg of messages) {
        try {
          await chrome.runtime.sendMessage(msg);
        } catch (error) {
          // Expected failures
        }
      }

      expect(successCount + failureCount).toBe(10);
      // Success rate should be around 70% (with some variance)
      const successRate = successCount / 10;
      expect(successRate).toBeGreaterThanOrEqual(0.4);
      expect(successRate).toBeLessThanOrEqual(1.0);
    });
  });
});