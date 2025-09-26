// Tests for cache management and cleanup functionality
require('./setup');

describe('Cache Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.resetChromeMocks();
  });

  describe('Cache Entry Lifecycle', () => {
    test('should create cache entry with correct structure', () => {
      const appId = '123456';
      const gameTitle = 'Portal 2';
      const hltbData = {
        mainStory: '8 Hours',
        mainExtra: '16 Hours',
        completionist: '32 Hours'
      };

      function createCacheEntry(appId, gameTitle, data) {
        return {
          [`hltb_${appId}`]: {
            data: data,
            timestamp: Date.now(),
            gameTitle: gameTitle,
            version: '1.0'
          }
        };
      }

      const entry = createCacheEntry(appId, gameTitle, hltbData);
      const cacheKey = `hltb_${appId}`;

      expect(entry[cacheKey]).toHaveProperty('data');
      expect(entry[cacheKey]).toHaveProperty('timestamp');
      expect(entry[cacheKey]).toHaveProperty('gameTitle');
      expect(entry[cacheKey]).toHaveProperty('version');
      expect(entry[cacheKey].data).toEqual(hltbData);
      expect(entry[cacheKey].gameTitle).toBe(gameTitle);
    });

    test('should validate cache entry before storage', () => {
      function isValidCacheEntry(entry) {
        if (!entry) return false;
        if (typeof entry !== 'object') return false;
        if (!entry.data || typeof entry.data !== 'object') return false;
        if (typeof entry.timestamp !== 'number' || entry.timestamp <= 0) return false;
        if (typeof entry.gameTitle !== 'string' || entry.gameTitle.length === 0) return false;
        return true;
      }

      const validEntry = {
        data: { mainStory: '10 Hours' },
        timestamp: Date.now(),
        gameTitle: 'Test Game'
      };

      const invalidEntries = [
        null,
        undefined,
        {},
        { data: null },
        { data: {}, timestamp: 'invalid' },
        { data: {}, timestamp: Date.now(), gameTitle: '' },
        { data: {}, timestamp: -1, gameTitle: 'Test' }
      ];

      expect(isValidCacheEntry(validEntry)).toBe(true);
      invalidEntries.forEach(entry => {
        expect(isValidCacheEntry(entry)).toBe(false);
      });
    });
  });

  describe('Cache Expiration', () => {
    test('should correctly determine cache expiration', () => {
      const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

      function isCacheExpired(entry, customDuration = CACHE_DURATION) {
        if (!entry || typeof entry.timestamp !== 'number') {
          return true;
        }
        return Date.now() - entry.timestamp > customDuration;
      }

      const now = Date.now();
      const testCases = [
        { timestamp: now - 1000, expired: false }, // 1 second ago
        { timestamp: now - 3600000, expired: false }, // 1 hour ago
        { timestamp: now - (24 * 60 * 60 * 1000), expired: false }, // 1 day ago
        { timestamp: now - (6 * 24 * 60 * 60 * 1000), expired: false }, // 6 days ago
        { timestamp: now - (7 * 24 * 60 * 60 * 1000) + 1000, expired: false }, // Just under 7 days
        { timestamp: now - (8 * 24 * 60 * 60 * 1000), expired: true }, // 8 days ago
        { timestamp: now - (30 * 24 * 60 * 60 * 1000), expired: true } // 30 days ago
      ];

      testCases.forEach(({ timestamp, expired }) => {
        const entry = { timestamp, data: {} };
        expect(isCacheExpired(entry)).toBe(expired);
      });
    });

    test('should handle different expiration durations', () => {
      const entry = { timestamp: Date.now() - (2 * 60 * 60 * 1000) }; // 2 hours ago

      function isCacheExpired(entry, duration) {
        return Date.now() - entry.timestamp > duration;
      }

      const oneHour = 60 * 60 * 1000;
      const threeHours = 3 * 60 * 60 * 1000;

      expect(isCacheExpired(entry, oneHour)).toBe(true);
      expect(isCacheExpired(entry, threeHours)).toBe(false);
    });

    test('should handle malformed timestamp', () => {
      const malformedEntries = [
        { timestamp: null },
        { timestamp: undefined },
        { timestamp: 'invalid' },
        { timestamp: NaN },
        { timestamp: Infinity }
      ];

      function isCacheExpired(entry) {
        if (!entry || typeof entry.timestamp !== 'number' || isNaN(entry.timestamp) || !isFinite(entry.timestamp)) {
          return true;
        }
        return Date.now() - entry.timestamp > (7 * 24 * 60 * 60 * 1000);
      }

      malformedEntries.forEach(entry => {
        expect(isCacheExpired(entry)).toBe(true);
      });
    });
  });

  describe('Cache Cleanup Strategies', () => {
    test('should identify expired entries for cleanup', async () => {
      const mockStorage = {
        'hltb_1': { timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000), data: {} },
        'hltb_2': { timestamp: Date.now() - (1 * 24 * 60 * 60 * 1000), data: {} },
        'hltb_3': { timestamp: Date.now() - (10 * 24 * 60 * 60 * 1000), data: {} },
        'enabled': true,
        'theme': 'dark'
      };

      chrome.storage.local.get.mockResolvedValue(mockStorage);

      function getExpiredCacheKeys(storage) {
        const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        return Object.entries(storage)
          .filter(([key, value]) =>
            key.startsWith('hltb_') &&
            value &&
            typeof value.timestamp === 'number' &&
            (now - value.timestamp) > CACHE_DURATION
          )
          .map(([key]) => key);
      }

      const storage = await chrome.storage.local.get(null);
      const expiredKeys = getExpiredCacheKeys(storage);

      expect(expiredKeys).toEqual(['hltb_1', 'hltb_3']);
      expect(expiredKeys).not.toContain('hltb_2');
    });

    test('should cleanup by LRU when approaching storage limits', () => {
      const entries = {
        'hltb_1': { timestamp: Date.now() - 5000, accessTime: Date.now() - 1000 },
        'hltb_2': { timestamp: Date.now() - 4000, accessTime: Date.now() - 3000 },
        'hltb_3': { timestamp: Date.now() - 3000, accessTime: Date.now() - 2000 }
      };

      function getLRUCacheKeys(storage, maxEntries = 2) {
        return Object.entries(storage)
          .filter(([key]) => key.startsWith('hltb_'))
          .sort(([, a], [, b]) => (a.accessTime || a.timestamp) - (b.accessTime || b.timestamp))
          .slice(0, -maxEntries)
          .map(([key]) => key);
      }

      const keysToRemove = getLRUCacheKeys(entries, 2);

      expect(keysToRemove).toEqual(['hltb_2']);
    });

    test('should cleanup by entry size for quota management', () => {
      const entries = {
        'hltb_1': { data: 'small'.repeat(100), timestamp: Date.now() },
        'hltb_2': { data: 'large'.repeat(10000), timestamp: Date.now() },
        'hltb_3': { data: 'medium'.repeat(1000), timestamp: Date.now() }
      };

      function getLargestCacheEntries(storage, percentage = 0.5) {
        const cacheEntries = Object.entries(storage)
          .filter(([key]) => key.startsWith('hltb_'))
          .map(([key, value]) => ({
            key,
            size: JSON.stringify(value).length
          }))
          .sort((a, b) => b.size - a.size);

        const count = Math.ceil(cacheEntries.length * percentage);
        return cacheEntries.slice(0, count).map(entry => entry.key);
      }

      const largestEntries = getLargestCacheEntries(entries);

      expect(largestEntries).toContain('hltb_2');
      expect(largestEntries.length).toBeGreaterThan(0);
    });
  });

  describe('Cache Statistics', () => {
    test('should calculate cache hit rate', () => {
      const stats = {
        hits: 85,
        misses: 15,
        total: 100
      };

      function calculateHitRate(hits, total) {
        return total > 0 ? (hits / total) : 0;
      }

      const hitRate = calculateHitRate(stats.hits, stats.total);

      expect(hitRate).toBe(0.85);
    });

    test('should track cache usage over time', () => {
      const usageHistory = [
        { date: '2024-01-01', entries: 10, totalSize: 5120 },
        { date: '2024-01-02', entries: 15, totalSize: 7680 },
        { date: '2024-01-03', entries: 20, totalSize: 10240 }
      ];

      function calculateGrowthRate(history) {
        if (history.length < 2) return 0;

        const start = history[0];
        const end = history[history.length - 1];

        return (end.entries - start.entries) / start.entries;
      }

      const growthRate = calculateGrowthRate(usageHistory);

      expect(growthRate).toBe(1.0); // 100% growth from 10 to 20 entries
    });

    test('should estimate storage usage by category', () => {
      const storage = {
        'hltb_1': { data: { mainStory: '10h' }, timestamp: Date.now() },
        'hltb_2': { data: { mainStory: '20h' }, timestamp: Date.now() },
        'enabled': true,
        'theme': 'dark',
        'settings': { custom: true }
      };

      function categorizeStorageUsage(storage) {
        let cacheSize = 0;
        let settingsSize = 0;
        let otherSize = 0;

        Object.entries(storage).forEach(([key, value]) => {
          const size = JSON.stringify(value).length;

          if (key.startsWith('hltb_')) {
            cacheSize += size;
          } else if (['enabled', 'theme', 'settings'].includes(key)) {
            settingsSize += size;
          } else {
            otherSize += size;
          }
        });

        return { cacheSize, settingsSize, otherSize };
      }

      const usage = categorizeStorageUsage(storage);

      expect(usage.cacheSize).toBeGreaterThan(0);
      expect(usage.settingsSize).toBeGreaterThan(0);
      expect(usage.otherSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cache Validation and Integrity', () => {
    test('should validate cache structure integrity', () => {
      function validateCacheStructure(entry) {
        const requiredFields = ['data', 'timestamp', 'gameTitle'];
        const optionalFields = ['version', 'accessTime', 'metadata'];

        if (!entry || typeof entry !== 'object') {
          return { valid: false, error: 'Invalid entry object' };
        }

        for (const field of requiredFields) {
          if (!(field in entry)) {
            return { valid: false, error: `Missing required field: ${field}` };
          }
        }

        if (!entry.data || typeof entry.data !== 'object') {
          return { valid: false, error: 'Invalid data structure' };
        }

        if (typeof entry.timestamp !== 'number' || entry.timestamp <= 0) {
          return { valid: false, error: 'Invalid timestamp' };
        }

        return { valid: true };
      }

      const validEntry = {
        data: { mainStory: '10 Hours' },
        timestamp: Date.now(),
        gameTitle: 'Test Game'
      };

      const invalidEntries = [
        { data: null, timestamp: Date.now(), gameTitle: 'Test' },
        { data: {}, timestamp: 'invalid', gameTitle: 'Test' },
        { data: {}, timestamp: Date.now() }, // Missing gameTitle
        {} // Missing all fields
      ];

      expect(validateCacheStructure(validEntry).valid).toBe(true);

      invalidEntries.forEach(entry => {
        const result = validateCacheStructure(entry);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    test('should detect and handle corrupted cache entries', async () => {
      const storage = {
        'hltb_valid': {
          data: { mainStory: '10 Hours' },
          timestamp: Date.now(),
          gameTitle: 'Valid Game'
        },
        'hltb_corrupted1': null,
        'hltb_corrupted2': 'string instead of object',
        'hltb_corrupted3': {
          data: { mainStory: '15 Hours' }
          // Missing timestamp and gameTitle
        }
      };

      chrome.storage.local.get.mockResolvedValue(storage);
      chrome.storage.local.remove.mockResolvedValue();

      function identifyCorruptedEntries(storage) {
        const corruptedKeys = [];

        Object.entries(storage).forEach(([key, value]) => {
          if (key.startsWith('hltb_')) {
            if (!value ||
                typeof value !== 'object' ||
                !value.data ||
                typeof value.timestamp !== 'number' ||
                !value.gameTitle) {
              corruptedKeys.push(key);
            }
          }
        });

        return corruptedKeys;
      }

      const result = await chrome.storage.local.get(null);
      const corruptedKeys = identifyCorruptedEntries(result);

      expect(corruptedKeys).toEqual(['hltb_corrupted1', 'hltb_corrupted2', 'hltb_corrupted3']);
      expect(corruptedKeys).not.toContain('hltb_valid');
    });

    test('should repair repairable cache entries', () => {
      function repairCacheEntry(entry, key) {
        if (!entry || typeof entry !== 'object') {
          return null; // Cannot repair
        }

        const repaired = { ...entry };

        // Add missing timestamp
        if (typeof repaired.timestamp !== 'number') {
          repaired.timestamp = Date.now();
        }

        // Add missing gameTitle from key
        if (!repaired.gameTitle && key.startsWith('hltb_')) {
          repaired.gameTitle = `Game ${key.replace('hltb_', '')}`;
        }

        // Ensure data exists
        if (!repaired.data || typeof repaired.data !== 'object') {
          repaired.data = { mainStory: 'Unknown' };
        }

        return repaired;
      }

      const repairableEntry = {
        data: { mainStory: '12 Hours' }
        // Missing timestamp and gameTitle
      };

      const repairedEntry = repairCacheEntry(repairableEntry, 'hltb_123');

      expect(repairedEntry).toHaveProperty('timestamp');
      expect(repairedEntry).toHaveProperty('gameTitle');
      expect(repairedEntry.data).toEqual({ mainStory: '12 Hours' });
      expect(typeof repairedEntry.timestamp).toBe('number');
    });
  });

  describe('Cache Performance Optimization', () => {
    test('should batch storage operations for efficiency', async () => {
      const batchOperations = [
        { type: 'set', key: 'hltb_1', data: { mainStory: '10h' } },
        { type: 'set', key: 'hltb_2', data: { mainStory: '20h' } },
        { type: 'remove', key: 'hltb_old' }
      ];

      chrome.storage.local.set.mockResolvedValue();
      chrome.storage.local.remove.mockResolvedValue();

      async function executeBatchOperations(operations) {
        const setOperations = {};
        const removeKeys = [];

        operations.forEach(op => {
          if (op.type === 'set') {
            setOperations[op.key] = {
              data: op.data,
              timestamp: Date.now(),
              gameTitle: `Game ${op.key.replace('hltb_', '')}`
            };
          } else if (op.type === 'remove') {
            removeKeys.push(op.key);
          }
        });

        const promises = [];

        if (Object.keys(setOperations).length > 0) {
          promises.push(chrome.storage.local.set(setOperations));
        }

        if (removeKeys.length > 0) {
          promises.push(chrome.storage.local.remove(removeKeys));
        }

        await Promise.all(promises);
      }

      await executeBatchOperations(batchOperations);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        'hltb_1': expect.any(Object),
        'hltb_2': expect.any(Object)
      });
      expect(chrome.storage.local.remove).toHaveBeenCalledWith(['hltb_old']);
    });

    test('should implement cache preloading strategy', () => {
      const recentlyViewed = ['123', '456', '789'];

      function generatePreloadKeys(gameIds) {
        return gameIds.map(id => `hltb_${id}`);
      }

      async function preloadCache(gameIds) {
        const keys = generatePreloadKeys(gameIds);
        const existing = await chrome.storage.local.get(keys);

        const missingIds = gameIds.filter(id => !existing[`hltb_${id}`]);
        return missingIds; // These would be fetched from API
      }

      chrome.storage.local.get.mockResolvedValue({
        'hltb_123': { data: {} }, // Exists
        // hltb_456 and hltb_789 missing
      });

      return preloadCache(recentlyViewed).then(missing => {
        expect(missing).toEqual(['456', '789']);
      });
    });
  });
});