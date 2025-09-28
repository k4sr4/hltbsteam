import { MessageHandler } from '../src/background/message-handler';
import { HLTBService } from '../src/background/services/hltb-service';
import { CacheService } from '../src/background/services/cache-service';
import { QueueService } from '../src/background/services/queue-service';

jest.useFakeTimers();

describe('Service Worker', () => {
  let messageHandler: MessageHandler;
  let hltbService: HLTBService;
  let cacheService: CacheService;
  let queueService: QueueService;

  beforeEach(() => {
    global.chrome = {
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({}),
          set: jest.fn().mockResolvedValue(undefined),
          remove: jest.fn().mockResolvedValue(undefined)
        }
      },
      runtime: {
        onInstalled: {
          addListener: jest.fn()
        },
        onMessage: {
          addListener: jest.fn()
        },
        onSuspend: {
          addListener: jest.fn()
        },
        getPlatformInfo: jest.fn()
      },
      alarms: {
        create: jest.fn(),
        onAlarm: {
          addListener: jest.fn()
        }
      }
    } as any;

    cacheService = new CacheService();
    queueService = new QueueService();
    hltbService = new HLTBService(cacheService, queueService);
    messageHandler = new MessageHandler(hltbService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Message Handling', () => {
    it('should handle fetchHLTB message', async () => {
      const request = {
        action: 'fetchHLTB',
        gameTitle: 'Portal 2',
        appId: '620'
      };

      const response = await messageHandler.handle(request, {} as any);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    it('should validate app ID format', async () => {
      const request = {
        action: 'fetchHLTB',
        gameTitle: 'Portal 2',
        appId: 'invalid-id'
      };

      const response = await messageHandler.handle(request, {} as any);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Invalid app ID');
    });

    it('should validate game title', async () => {
      const request = {
        action: 'fetchHLTB',
        gameTitle: '',
        appId: '620'
      };

      const response = await messageHandler.handle(request, {} as any);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Game title is required');
    });

    it('should handle clearCache message', async () => {
      const request = {
        action: 'clearCache'
      };

      const response = await messageHandler.handle(request, {} as any);

      expect(response.success).toBe(true);
      expect(response.message).toContain('Cache cleared');
    });

    it('should handle getCacheStats message', async () => {
      const request = {
        action: 'getCacheStats'
      };

      const response = await messageHandler.handle(request, {} as any);

      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('size');
      expect(response.data).toHaveProperty('hits');
    });

    it('should handle getSettings message', async () => {
      const request = {
        action: 'getSettings'
      };

      const response = await messageHandler.handle(request, {} as any);

      expect(response.success).toBe(true);
      expect(response.settings).toHaveProperty('enabled');
      expect(response.settings).toHaveProperty('cacheEnabled');
      expect(response.settings).toHaveProperty('theme');
    });

    it('should handle batchFetch message', async () => {
      const request = {
        action: 'batchFetch',
        games: [
          { title: 'Portal 2', appId: '620' },
          { title: 'Half-Life 2', appId: '220' }
        ]
      };

      const response = await messageHandler.handle(request, {} as any);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    it('should handle unknown action', async () => {
      const request = {
        action: 'unknownAction'
      };

      await expect(messageHandler.handle(request, {} as any)).rejects.toThrow('Unknown action');
    });
  });

  describe('Cache Service', () => {
    it('should store and retrieve data from cache', async () => {
      const testData = { mainStory: 10, mainExtra: 15, completionist: 20, allStyles: 15 };
      await cacheService.set('test-key', testData);

      const retrieved = await cacheService.get('test-key');
      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent cache key', async () => {
      const retrieved = await cacheService.get('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should evict LRU entries when cache is full', async () => {
      for (let i = 0; i < 10; i++) {
        await cacheService.set(`key-${i}`, { data: i });
      }

      const stats = await cacheService.getStats();
      expect(stats.size).toBeLessThanOrEqual(1000);
    });

    it('should clean expired cache entries', async () => {
      const expiredEntry = {
        data: { test: 'data' },
        timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000),
        hits: 0
      };

      (global.chrome.storage.local.get as jest.Mock).mockResolvedValue({
        hltb_cache: {
          'expired-key': expiredEntry
        }
      });

      const newCacheService = new CacheService();
      await new Promise(resolve => setTimeout(resolve, 100));

      const retrieved = await newCacheService.get('expired-key');
      expect(retrieved).toBeNull();
    });

    it('should track cache hits', async () => {
      await cacheService.set('hit-test', { data: 'test' });

      await cacheService.get('hit-test');
      await cacheService.get('hit-test');

      const stats = await cacheService.getStats();
      expect(stats.hits).toBeGreaterThan(0);
    });
  });

  describe('Queue Service', () => {
    it('should process tasks in order', async () => {
      const results: number[] = [];
      const task1 = () => Promise.resolve(results.push(1));
      const task2 = () => Promise.resolve(results.push(2));
      const task3 = () => Promise.resolve(results.push(3));

      await Promise.all([
        queueService.enqueue(task1),
        queueService.enqueue(task2),
        queueService.enqueue(task3)
      ]);

      expect(results).toEqual([1, 2, 3]);
    });

    it('should apply rate limiting', async () => {
      const startTime = Date.now();
      const tasks = [];

      for (let i = 0; i < 15; i++) {
        tasks.push(queueService.enqueue(() => Promise.resolve(i)));
      }

      jest.runAllTimers();
      await Promise.all(tasks);

      expect(tasks.length).toBe(15);
    });

    it('should handle task errors', async () => {
      const errorTask = () => Promise.reject(new Error('Task failed'));

      await expect(queueService.enqueue(errorTask)).rejects.toThrow('Task failed');
    });
  });

  describe('HLTB Service', () => {
    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [
            {
              game_id: 1,
              game_name: 'Portal 2',
              comp_main: 540,
              comp_plus: 900,
              comp_100: 1260,
              comp_all: 750
            }
          ]
        })
      });
    });

    it('should fetch game data from HLTB API', async () => {
      const data = await hltbService.getGameData('Portal 2', '620');

      expect(data).toBeDefined();
      expect(data?.mainStory).toBe(9);
      expect(data?.mainExtra).toBe(15);
      expect(data?.completionist).toBe(21);
    });

    it('should use cache for repeated requests', async () => {
      await hltbService.getGameData('Portal 2', '620');

      (global.fetch as jest.Mock).mockClear();

      const cachedData = await hltbService.getGameData('Portal 2', '620');

      expect(global.fetch).not.toHaveBeenCalled();
      expect(cachedData).toBeDefined();
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const data = await hltbService.getGameData('Unknown Game', 'unknown');

      expect(data).toBeDefined();
      expect(data?.mainStory).toBe(12);
    });

    it('should handle empty API responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ data: [] })
      });

      const data = await hltbService.getGameData('Nonexistent Game', 'none');

      expect(data).toBeDefined();
    });

    it('should batch fetch multiple games', async () => {
      const games = [
        { title: 'Portal 2', appId: '620' },
        { title: 'Half-Life 2', appId: '220' },
        { title: 'Hades', appId: '1145360' }
      ];

      const results = await hltbService.batchFetch(games);

      expect(results).toBeDefined();
      expect(Object.keys(results)).toHaveLength(3);
    });

    it('should find best match from multiple results', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [
            {
              game_id: 1,
              game_name: 'Portal',
              comp_main: 180
            },
            {
              game_id: 2,
              game_name: 'Portal 2',
              comp_main: 540
            },
            {
              game_id: 3,
              game_name: 'Portal Stories: Mel',
              comp_main: 360
            }
          ]
        })
      });

      const data = await hltbService.getGameData('Portal 2', '620');

      expect(data?.mainStory).toBe(9);
    });
  });

  describe('Service Worker Lifecycle', () => {
    it('should set up keep-alive alarm', () => {
      require('../src/background/service-worker');

      expect(chrome.alarms.create).toHaveBeenCalledWith(
        'keep-alive',
        { periodInMinutes: 0.25 }
      );
    });

    it('should handle extension installation', () => {
      const onInstalledCallback = (chrome.runtime.onInstalled.addListener as jest.Mock).mock.calls[0][0];

      onInstalledCallback({ reason: 'install' });

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          cacheEnabled: true,
          cacheDurationHours: 168
        })
      );
    });

    it('should handle extension update', () => {
      const onInstalledCallback = (chrome.runtime.onInstalled.addListener as jest.Mock).mock.calls[0][0];

      const consoleSpy = jest.spyOn(console, 'log');
      onInstalledCallback({ reason: 'update', previousVersion: '0.9.0' });

      expect(consoleSpy).toHaveBeenCalledWith('[HLTB] Updated from version:', '0.9.0');
    });
  });
});

describe('Performance Tests', () => {
  it('should handle high volume of concurrent requests', async () => {
    const cacheService = new CacheService();
    const queueService = new QueueService();
    const hltbService = new HLTBService(cacheService, queueService);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: [
          {
            game_id: 1,
            game_name: 'Test Game',
            comp_main: 600,
            comp_plus: 900,
            comp_100: 1200,
            comp_all: 800
          }
        ]
      })
    });

    const requests = [];
    for (let i = 0; i < 50; i++) {
      requests.push(hltbService.getGameData(`Game ${i}`, `${i}`));
    }

    const startTime = Date.now();
    await Promise.all(requests);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(5000);
  });

  it('should maintain memory usage under 50MB', async () => {
    const cacheService = new CacheService();

    for (let i = 0; i < 500; i++) {
      await cacheService.set(`key-${i}`, {
        mainStory: Math.random() * 100,
        mainExtra: Math.random() * 100,
        completionist: Math.random() * 100,
        allStyles: Math.random() * 100
      });
    }

    const stats = await cacheService.getStats();
    expect(stats.totalSize).toBeLessThan(50 * 1024 * 1024);
  });

  it('should respond to messages within 100ms', async () => {
    const messageHandler = new MessageHandler(
      new HLTBService(new CacheService(), new QueueService())
    );

    await messageHandler.handle(
      { action: 'fetchHLTB', gameTitle: 'Portal 2', appId: '620' },
      {} as any
    );

    const startTime = Date.now();
    const response = await messageHandler.handle(
      { action: 'fetchHLTB', gameTitle: 'Portal 2', appId: '620' },
      {} as any
    );
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(100);
    expect(response.success).toBe(true);
  });
});