// Tests for Chrome storage operations
require('./setup');

describe('Chrome Storage Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.resetChromeMocks();
  });

  describe('Settings Persistence', () => {
    test('should save settings to local storage', async () => {
      const settings = {
        enabled: true,
        cacheEnabled: false,
        theme: 'dark'
      };

      chrome.storage.local.set.mockResolvedValue();

      await chrome.storage.local.set(settings);

      expect(chrome.storage.local.set).toHaveBeenCalledWith(settings);
    });

    test('should retrieve settings from local storage', async () => {
      const storedSettings = {
        enabled: false,
        cacheEnabled: true,
        theme: 'light'
      };

      chrome.storage.local.get.mockResolvedValue(storedSettings);

      const result = await chrome.storage.local.get(['enabled', 'cacheEnabled', 'theme']);

      expect(result).toEqual(storedSettings);
      expect(chrome.storage.local.get).toHaveBeenCalledWith(['enabled', 'cacheEnabled', 'theme']);
    });

    test('should handle partial settings retrieval', async () => {
      chrome.storage.local.get.mockResolvedValue({
        enabled: true
        // cacheEnabled and theme missing
      });

      const result = await chrome.storage.local.get(['enabled', 'cacheEnabled', 'theme']);

      expect(result.enabled).toBe(true);
      expect(result.cacheEnabled).toBeUndefined();
      expect(result.theme).toBeUndefined();
    });

    test('should apply default values for missing settings', async () => {
      chrome.storage.local.get.mockResolvedValue({
        theme: 'dark'
        // enabled and cacheEnabled missing
      });

      function applyDefaults(settings) {
        return {
          enabled: settings.enabled !== false, // Default true
          cacheEnabled: settings.cacheEnabled !== false, // Default true
          theme: settings.theme || 'auto'
        };
      }

      const result = await chrome.storage.local.get(['enabled', 'cacheEnabled', 'theme']);
      const finalSettings = applyDefaults(result);

      expect(finalSettings).toEqual({
        enabled: true,
        cacheEnabled: true,
        theme: 'dark'
      });
    });

    test('should handle settings storage errors', async () => {
      chrome.storage.local.set.mockRejectedValue(new Error('Storage quota exceeded'));

      await expect(
        chrome.storage.local.set({ enabled: true })
      ).rejects.toThrow('Storage quota exceeded');
    });

    test('should handle settings retrieval errors', async () => {
      chrome.storage.local.get.mockRejectedValue(new Error('Storage corruption'));

      await expect(
        chrome.storage.local.get(['enabled'])
      ).rejects.toThrow('Storage corruption');
    });
  });

  describe('Cache Storage and Retrieval', () => {
    test('should store cache entries with timestamp', async () => {
      const appId = '12345';
      const cacheKey = `hltb_${appId}`;
      const gameData = {
        mainStory: '8 Hours',
        mainExtra: '16 Hours',
        completionist: '32 Hours'
      };

      const cacheEntry = {
        data: gameData,
        timestamp: Date.now(),
        gameTitle: 'Portal 2'
      };

      chrome.storage.local.set.mockResolvedValue();

      await chrome.storage.local.set({ [cacheKey]: cacheEntry });

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        [cacheKey]: cacheEntry
      });
    });

    test('should retrieve cache entries', async () => {
      const cacheKey = 'hltb_67890';
      const cacheEntry = {
        data: { mainStory: '12 Hours' },
        timestamp: Date.now() - 3600000, // 1 hour ago
        gameTitle: 'Half-Life 2'
      };

      chrome.storage.local.get.mockResolvedValue({
        [cacheKey]: cacheEntry
      });

      const result = await chrome.storage.local.get(cacheKey);

      expect(result[cacheKey]).toEqual(cacheEntry);
    });

    test('should identify expired cache entries', () => {
      const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

      function isCacheExpired(cacheEntry) {
        return Date.now() - cacheEntry.timestamp > CACHE_DURATION;
      }

      const freshEntry = { timestamp: Date.now() - 3600000 }; // 1 hour ago
      const expiredEntry = { timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000) }; // 8 days ago

      expect(isCacheExpired(freshEntry)).toBe(false);
      expect(isCacheExpired(expiredEntry)).toBe(true);
    });

    test('should filter cache keys from all storage', async () => {
      const allStorage = {
        'hltb_123': { data: {} },
        'hltb_456': { data: {} },
        'hltb_789': { data: {} },
        'enabled': true,
        'theme': 'dark',
        'installDate': Date.now()
      };

      chrome.storage.local.get.mockResolvedValue(allStorage);

      const result = await chrome.storage.local.get(null);
      const cacheKeys = Object.keys(result).filter(key => key.startsWith('hltb_'));

      expect(cacheKeys).toEqual(['hltb_123', 'hltb_456', 'hltb_789']);
      expect(cacheKeys.length).toBe(3);
    });

    test('should remove specific cache entries', async () => {
      const keysToRemove = ['hltb_123', 'hltb_456'];

      chrome.storage.local.remove.mockResolvedValue();

      await chrome.storage.local.remove(keysToRemove);

      expect(chrome.storage.local.remove).toHaveBeenCalledWith(keysToRemove);
    });

    test('should clear all cache entries while preserving settings', async () => {
      const allStorage = {
        'hltb_100': { data: {} },
        'hltb_200': { data: {} },
        'enabled': true,
        'theme': 'light'
      };

      chrome.storage.local.get.mockResolvedValue(allStorage);
      chrome.storage.local.remove.mockResolvedValue();

      // Simulate cache clearing logic
      const cacheKeys = Object.keys(allStorage).filter(key => key.startsWith('hltb_'));
      await chrome.storage.local.remove(cacheKeys);

      expect(chrome.storage.local.remove).toHaveBeenCalledWith(['hltb_100', 'hltb_200']);
    });
  });

  describe('Storage Limits and Quotas', () => {
    test('should handle quota exceeded errors', async () => {
      const largeData = 'x'.repeat(10 * 1024 * 1024); // 10MB string

      chrome.storage.local.set.mockRejectedValue(
        new Error('QUOTA_BYTES_PER_ITEM quota exceeded')
      );

      await expect(
        chrome.storage.local.set({ largeCache: largeData })
      ).rejects.toThrow('QUOTA_BYTES_PER_ITEM quota exceeded');
    });

    test('should calculate approximate storage usage', async () => {
      const storage = {
        'hltb_1': { data: { mainStory: '10 Hours' } },
        'hltb_2': { data: { mainStory: '20 Hours' } },
        'enabled': true
      };

      chrome.storage.local.get.mockResolvedValue(storage);

      function estimateStorageSize(obj) {
        return JSON.stringify(obj).length;
      }

      const result = await chrome.storage.local.get(null);
      const estimatedSize = estimateStorageSize(result);

      expect(estimatedSize).toBeGreaterThan(0);
      expect(typeof estimatedSize).toBe('number');
    });

    test('should implement storage cleanup when approaching limits', async () => {
      const storage = {};

      // Create 100 cache entries
      for (let i = 0; i < 100; i++) {
        storage[`hltb_${i}`] = {
          data: { mainStory: `${i} Hours` },
          timestamp: Date.now() - (i * 24 * 60 * 60 * 1000), // i days ago
          gameTitle: `Game ${i}`
        };
      }

      chrome.storage.local.get.mockResolvedValue(storage);
      chrome.storage.local.remove.mockResolvedValue();

      // Simulate cleanup of entries older than 30 days
      const CLEANUP_THRESHOLD = 30 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const oldEntries = Object.entries(storage)
        .filter(([key, value]) =>
          key.startsWith('hltb_') &&
          (now - value.timestamp) > CLEANUP_THRESHOLD
        )
        .map(([key]) => key);

      await chrome.storage.local.remove(oldEntries);

      expect(oldEntries.length).toBeGreaterThan(0);
      expect(chrome.storage.local.remove).toHaveBeenCalledWith(oldEntries);
    });
  });

  describe('Data Migration Scenarios', () => {
    test('should migrate from old to new storage format', async () => {
      // Simulate old format
      const oldFormat = {
        'game_123': 'Portal 2: 8 Hours',
        'game_456': 'Half-Life 2: 12 Hours'
      };

      // New format
      function migrateToNewFormat(oldData) {
        const newData = {};

        Object.entries(oldData).forEach(([key, value]) => {
          if (key.startsWith('game_')) {
            const appId = key.replace('game_', '');
            const newKey = `hltb_${appId}`;

            // Parse old string format
            const parts = value.split(': ');
            const gameTitle = parts[0];
            const timeStr = parts[1];

            newData[newKey] = {
              data: { mainStory: timeStr },
              timestamp: Date.now(),
              gameTitle: gameTitle
            };
          }
        });

        return newData;
      }

      const migratedData = migrateToNewFormat(oldFormat);

      expect(migratedData).toEqual({
        'hltb_123': {
          data: { mainStory: '8 Hours' },
          timestamp: expect.any(Number),
          gameTitle: 'Portal 2'
        },
        'hltb_456': {
          data: { mainStory: '12 Hours' },
          timestamp: expect.any(Number),
          gameTitle: 'Half-Life 2'
        }
      });
    });

    test('should handle version-based migration', async () => {
      chrome.storage.local.get.mockResolvedValue({
        version: '1.0.0',
        enabled: true,
        // Old format data...
      });

      function needsMigration(currentVersion, targetVersion) {
        // Simple version comparison
        return currentVersion !== targetVersion;
      }

      async function performMigration() {
        const data = await chrome.storage.local.get(null);

        if (needsMigration(data.version, '2.0.0')) {
          // Perform migration steps
          const migratedData = { ...data, version: '2.0.0' };
          await chrome.storage.local.set(migratedData);
          return true;
        }
        return false;
      }

      chrome.storage.local.set.mockResolvedValue();

      const migrated = await performMigration();

      expect(migrated).toBe(true);
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({ version: '2.0.0' })
      );
    });

    test('should backup data before migration', async () => {
      const originalData = {
        enabled: true,
        'hltb_123': { data: {} }
      };

      chrome.storage.local.get.mockResolvedValue(originalData);
      chrome.storage.local.set.mockResolvedValue();

      async function backupBeforeMigration() {
        const data = await chrome.storage.local.get(null);
        const backup = {
          ...data,
          backupTimestamp: Date.now()
        };

        await chrome.storage.local.set({
          'migration_backup': backup
        });

        return backup;
      }

      const backup = await backupBeforeMigration();

      expect(backup).toEqual({
        ...originalData,
        backupTimestamp: expect.any(Number)
      });

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        'migration_backup': backup
      });
    });

    test('should rollback migration on failure', async () => {
      const originalData = { enabled: true };
      const backup = { ...originalData, backupTimestamp: Date.now() };

      chrome.storage.local.get
        .mockResolvedValueOnce(originalData) // Initial read
        .mockResolvedValueOnce({ 'migration_backup': backup }); // Backup read

      chrome.storage.local.set
        .mockResolvedValueOnce() // Backup save
        .mockRejectedValueOnce(new Error('Migration failed')) // Migration fails
        .mockResolvedValueOnce(); // Rollback succeeds

      chrome.storage.local.remove.mockResolvedValue();

      async function attemptMigrationWithRollback() {
        const data = await chrome.storage.local.get(null);

        // Create backup
        await chrome.storage.local.set({
          'migration_backup': { ...data, backupTimestamp: Date.now() }
        });

        try {
          // Attempt migration
          await chrome.storage.local.set({ migrated: true });
          throw new Error('Migration failed'); // Simulate failure
        } catch (error) {
          // Rollback
          const backupData = await chrome.storage.local.get('migration_backup');
          const { backupTimestamp, ...original } = backupData.migration_backup;

          await chrome.storage.local.clear();
          await chrome.storage.local.set(original);

          throw error;
        }
      }

      await expect(attemptMigrationWithRollback()).rejects.toThrow('Migration failed');
    });
  });

  describe('Sync vs Local Storage', () => {
    test('should use sync storage for settings', async () => {
      const settings = { theme: 'dark', enabled: true };

      chrome.storage.sync.set.mockResolvedValue();
      chrome.storage.sync.get.mockResolvedValue(settings);

      await chrome.storage.sync.set(settings);
      const result = await chrome.storage.sync.get(['theme', 'enabled']);

      expect(chrome.storage.sync.set).toHaveBeenCalledWith(settings);
      expect(result).toEqual(settings);
    });

    test('should use local storage for cache data', async () => {
      const cacheData = {
        'hltb_123': {
          data: { mainStory: '10 Hours' },
          timestamp: Date.now()
        }
      };

      chrome.storage.local.set.mockResolvedValue();

      await chrome.storage.local.set(cacheData);

      expect(chrome.storage.local.set).toHaveBeenCalledWith(cacheData);
      expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    });

    test('should handle sync storage unavailability', async () => {
      chrome.storage.sync.set.mockRejectedValue(
        new Error('Sync is currently disabled')
      );

      chrome.storage.local.set.mockResolvedValue();

      // Fallback to local storage
      async function saveSettingsWithFallback(settings) {
        try {
          await chrome.storage.sync.set(settings);
        } catch (error) {
          console.warn('Sync unavailable, using local storage:', error.message);
          await chrome.storage.local.set(settings);
        }
      }

      await saveSettingsWithFallback({ enabled: true });

      expect(chrome.storage.sync.set).toHaveBeenCalled();
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });
  });

  describe('Storage Event Handling', () => {
    test('should handle concurrent storage operations', async () => {
      const operations = [
        () => chrome.storage.local.set({ key1: 'value1' }),
        () => chrome.storage.local.set({ key2: 'value2' }),
        () => chrome.storage.local.get(['key1']),
        () => chrome.storage.local.remove(['key2'])
      ];

      chrome.storage.local.set.mockResolvedValue();
      chrome.storage.local.get.mockResolvedValue({});
      chrome.storage.local.remove.mockResolvedValue();

      // Execute all operations concurrently
      await Promise.all(operations.map(op => op()));

      expect(chrome.storage.local.set).toHaveBeenCalledTimes(2);
      expect(chrome.storage.local.get).toHaveBeenCalledTimes(1);
      expect(chrome.storage.local.remove).toHaveBeenCalledTimes(1);
    });

    test('should handle storage corruption gracefully', async () => {
      chrome.storage.local.get.mockImplementation(() => {
        throw new Error('Storage corrupted');
      });

      async function safeStorageGet(keys, fallback = {}) {
        try {
          return await chrome.storage.local.get(keys);
        } catch (error) {
          console.error('Storage error:', error);
          return fallback;
        }
      }

      const result = await safeStorageGet(['enabled'], { enabled: true });

      expect(result).toEqual({ enabled: true });
      expect(console.error).toHaveBeenCalledWith(
        'Storage error:',
        expect.any(Error)
      );
    });
  });
});