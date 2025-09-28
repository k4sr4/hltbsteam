describe('Service Worker Basic Tests', () => {
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
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize without errors', () => {
    expect(() => {
      require('../dist/background.js');
    }).not.toThrow();
  });

  it('should have chrome APIs mocked correctly', () => {
    expect(chrome.storage).toBeDefined();
    expect(chrome.runtime).toBeDefined();
    expect(chrome.alarms).toBeDefined();
  });

  it('should set up event listeners on load', () => {
    require('../dist/background.js');

    expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalled();
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    expect(chrome.alarms.create).toHaveBeenCalledWith(
      'keep-alive',
      expect.objectContaining({ periodInMinutes: 0.25 })
    );
  });

  it('should handle installation correctly', async () => {
    require('../dist/background.js');

    const onInstalledCallback = chrome.runtime.onInstalled.addListener.mock.calls[0][0];

    await onInstalledCallback({ reason: 'install' });

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        cacheEnabled: true,
        cacheDurationHours: 168
      })
    );
  });

  it('should handle message events', () => {
    require('../dist/background.js');

    const messageHandler = chrome.runtime.onMessage.addListener.mock.calls[0][0];

    expect(typeof messageHandler).toBe('function');
  });
});