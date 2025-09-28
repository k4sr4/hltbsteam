/**
 * Unit tests for NavigationObserver class
 * Tests SPA navigation detection, performance optimization, memory management,
 * and state notifications
 */

import { NavigationObserver, ObservationStats } from '../../src/content/navigation/NavigationObserver';
import { StateManager } from '../../src/content/navigation/StateManager';
import { NavigationState, NavigationType, ObservationConfig } from '../../src/content/types';
import { mockChromeAPIs, mockPerformanceAPI } from '../mocks/steamPageMocks';

// Mock the DOM utilities
jest.mock('../../src/content/utils/dom', () => ({
  debounce: jest.fn((fn, delay) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }),
  throttle: jest.fn((fn, delay) => {
    let lastCall = 0;
    return (...args: any[]) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        fn(...args);
      }
    };
  })
}));

describe('NavigationObserver', () => {
  let observer: NavigationObserver;
  let mockStateManager: jest.Mocked<StateManager>;
  let mockNavigationState: NavigationState;

  beforeAll(() => {
    mockChromeAPIs();
    mockPerformanceAPI();
  });

  beforeEach(() => {
    // Create mock navigation state
    mockNavigationState = {
      currentUrl: 'https://store.steampowered.com/app/730/',
      previousUrl: '',
      isInitialLoad: true,
      isLoading: false,
      navigationTime: Date.now(),
      navigationType: NavigationType.INITIAL_LOAD
    };

    // Create mock StateManager
    mockStateManager = {
      getCurrentState: jest.fn().mockReturnValue(mockNavigationState),
      addListener: jest.fn().mockReturnValue(() => {}),
      isGamePage: jest.fn().mockReturnValue(true),
      getCurrentAppId: jest.fn().mockReturnValue('730'),
      initialize: jest.fn(),
      removeAllListeners: jest.fn(),
      updateState: jest.fn(),
      isGamePageNavigation: jest.fn(),
      destroy: jest.fn()
    } as any;

    observer = new NavigationObserver(mockStateManager);

    // Mock MutationObserver
    global.MutationObserver = jest.fn().mockImplementation((callback) => ({
      observe: jest.fn(),
      disconnect: jest.fn(),
      takeRecords: jest.fn()
    }));
  });

  afterEach(() => {
    observer.stop();
    jest.clearAllMocks();
  });

  describe('Initialization and Lifecycle', () => {
    test('should initialize with default configuration', () => {
      expect(observer.isObserving()).toBe(false);
      expect(observer.getCurrentState()).toEqual(mockNavigationState);
    });

    test('should start observation correctly', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      observer.start();

      expect(observer.isObserving()).toBe(true);
      expect(mockStateManager.addListener).toHaveBeenCalled();
      expect(MutationObserver).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('[HLTB] NavigationObserver started');

      consoleSpy.mockRestore();
    });

    test('should not start if already active', () => {
      observer.start();
      const initialCallCount = mockStateManager.addListener.mock.calls.length;

      observer.start(); // Second call

      expect(mockStateManager.addListener.mock.calls.length).toBe(initialCallCount);
    });

    test('should stop observation correctly', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      observer.start();
      observer.stop();

      expect(observer.isObserving()).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('[HLTB] NavigationObserver stopped');

      consoleSpy.mockRestore();
    });

    test('should not stop if already inactive', () => {
      observer.stop(); // Should not throw or cause issues
      expect(observer.isObserving()).toBe(false);
    });

    test('should accept custom configuration', () => {
      const customConfig: ObservationConfig = {
        childList: false,
        subtree: false,
        attributes: true,
        attributeFilter: ['data-appid'],
        debounceDelay: 200
      };

      const customObserver = new NavigationObserver(mockStateManager, customConfig);
      expect(customObserver['config']).toMatchObject(customConfig);
    });
  });

  describe('Listener Management', () => {
    test('should add and remove listeners correctly', () => {
      const mockListener = jest.fn();

      const unsubscribe = observer.addListener(mockListener);
      expect(observer['listeners'].has(mockListener)).toBe(true);

      unsubscribe();
      expect(observer['listeners'].has(mockListener)).toBe(false);
    });

    test('should handle multiple listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      observer.addListener(listener1);
      observer.addListener(listener2);

      expect(observer['listeners'].size).toBe(2);

      observer.removeAllListeners();
      expect(observer['listeners'].size).toBe(0);
    });

    test('should notify listeners on state changes', () => {
      const mockListener = jest.fn();
      observer.addListener(mockListener);

      observer['notifyListeners'](mockNavigationState);

      expect(mockListener).toHaveBeenCalledWith(mockNavigationState);
    });

    test('should handle listener errors gracefully', () => {
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const workingListener = jest.fn();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      observer.addListener(errorListener);
      observer.addListener(workingListener);

      observer['notifyListeners'](mockNavigationState);

      expect(consoleSpy).toHaveBeenCalledWith('[HLTB] Error in navigation listener:', expect.any(Error));
      expect(workingListener).toHaveBeenCalled(); // Other listeners should still work

      consoleSpy.mockRestore();
    });
  });

  describe('State Change Handling', () => {
    test('should handle state changes from StateManager', () => {
      const mockListener = jest.fn();
      observer.addListener(mockListener);

      // Simulate state manager calling listener
      const stateManagerListener = mockStateManager.addListener.mock.calls[0][0];
      stateManagerListener(mockNavigationState);

      expect(mockListener).toHaveBeenCalledWith(mockNavigationState);
    });

    test('should handle state change errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('State change error');
      });

      observer.addListener(errorListener);
      observer['handleStateChange'](mockNavigationState);

      expect(consoleSpy).toHaveBeenCalledWith('[HLTB] Error handling state change:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    test('should force state check manually', () => {
      const mockListener = jest.fn();
      observer.addListener(mockListener);

      observer.forceStateCheck();

      expect(mockStateManager.getCurrentState).toHaveBeenCalled();
      expect(mockListener).toHaveBeenCalledWith(mockNavigationState);
    });
  });

  describe('DOM Observation Setup', () => {
    test('should create multiple observers for different DOM parts', () => {
      observer.start();

      // Should create observers for: body, head, title
      expect(MutationObserver).toHaveBeenCalledTimes(3);
    });

    test('should observe document.body with correct options', () => {
      const mockObserver = {
        observe: jest.fn(),
        disconnect: jest.fn()
      };
      (MutationObserver as jest.Mock).mockReturnValue(mockObserver);

      observer.start();

      expect(mockObserver.observe).toHaveBeenCalledWith(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        attributeFilter: []
      });
    });

    test('should observe document.head for meta changes', () => {
      const mockObserver = {
        observe: jest.fn(),
        disconnect: jest.fn()
      };
      (MutationObserver as jest.Mock).mockReturnValue(mockObserver);

      observer.start();

      expect(mockObserver.observe).toHaveBeenCalledWith(document.head, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['content', 'property', 'name']
      });
    });

    test('should handle missing title element gracefully', () => {
      const originalTitle = document.querySelector;
      document.querySelector = jest.fn().mockReturnValue(null);

      expect(() => observer.start()).not.toThrow();

      document.querySelector = originalTitle;
    });
  });

  describe('Mutation Filtering', () => {
    test('should identify relevant mutations for game detection', () => {
      // Test relevant selector mutations
      const relevantSelectors = [
        '.game_area_purchase',
        '.apphub_AppName',
        '.breadcrumbs',
        '[data-appid]',
        'meta[property="og:title"]',
        'meta[name="twitter:title"]'
      ];

      relevantSelectors.forEach(selector => {
        const mockElement = document.createElement('div');
        mockElement.className = selector.replace(/[.[\]]/g, '');

        const mutation: MutationRecord = {
          type: 'childList',
          target: document.body,
          addedNodes: [mockElement],
          removedNodes: [],
          previousSibling: null,
          nextSibling: null,
          attributeName: null,
          attributeNamespace: null,
          oldValue: null
        };

        expect(observer['isRelevantMutation'](mutation)).toBe(true);
      });
    });

    test('should ignore irrelevant mutations', () => {
      const mockElement = document.createElement('span');
      mockElement.className = 'irrelevant-class';

      const mutation: MutationRecord = {
        type: 'childList',
        target: document.body,
        addedNodes: [mockElement],
        removedNodes: [],
        previousSibling: null,
        nextSibling: null,
        attributeName: null,
        attributeNamespace: null,
        oldValue: null
      };

      expect(observer['isRelevantMutation'](mutation)).toBe(false);
    });

    test('should detect relevant attribute changes', () => {
      const mutation: MutationRecord = {
        type: 'attributes',
        target: document.createElement('div'),
        addedNodes: [],
        removedNodes: [],
        previousSibling: null,
        nextSibling: null,
        attributeName: 'data-appid',
        attributeNamespace: null,
        oldValue: null
      };

      expect(observer['isRelevantMutation'](mutation)).toBe(true);
    });

    test('should handle malformed elements in mutation detection', () => {
      const textNode = document.createTextNode('text');

      const mutation: MutationRecord = {
        type: 'childList',
        target: document.body,
        addedNodes: [textNode], // Not an element
        removedNodes: [],
        previousSibling: null,
        nextSibling: null,
        attributeName: null,
        attributeNamespace: null,
        oldValue: null
      };

      expect(() => observer['isRelevantMutation'](mutation)).not.toThrow();
      expect(observer['isRelevantMutation'](mutation)).toBe(false);
    });
  });

  describe('Configuration Updates', () => {
    test('should update configuration and restart observers', () => {
      observer.start();
      const initialObserverCount = (MutationObserver as jest.Mock).mock.calls.length;

      observer.updateConfig({ debounceDelay: 200, attributes: true });

      expect(observer['config'].debounceDelay).toBe(200);
      expect(observer['config'].attributes).toBe(true);

      // Should have restarted observers
      expect((MutationObserver as jest.Mock).mock.calls.length).toBeGreaterThan(initialObserverCount);
    });

    test('should update configuration when not active', () => {
      observer.updateConfig({ debounceDelay: 300 });

      expect(observer['config'].debounceDelay).toBe(300);
      expect(observer.isObserving()).toBe(false);
    });
  });

  describe('Performance Monitoring', () => {
    test('should provide observation statistics', () => {
      observer.start();
      observer.addListener(jest.fn());

      const stats = observer.getStats();

      expect(stats).toMatchObject({
        isActive: true,
        observerCount: observer['observers'].size,
        listenerCount: 1,
        currentUrl: mockNavigationState.currentUrl,
        isGamePage: true,
        appId: '730'
      });
    });

    test('should monitor performance metrics', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Mock high observer count
      observer['observers'] = new Set(Array(15).fill({})) as any;
      observer['checkPerformance']();

      expect(consoleSpy).toHaveBeenCalledWith('[HLTB] High observer count: 15');

      consoleSpy.mockRestore();
    });

    test('should warn about high listener count', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Add many listeners
      for (let i = 0; i < 25; i++) {
        observer.addListener(jest.fn());
      }
      observer['checkPerformance']();

      expect(consoleSpy).toHaveBeenCalledWith('[HLTB] High listener count: 25');

      consoleSpy.mockRestore();
    });

    test('should monitor memory usage when available', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Mock high memory usage
      const mockMemory = {
        usedJSHeapSize: 60 * 1024 * 1024, // 60MB
        totalJSHeapSize: 100 * 1024 * 1024,
        jsHeapSizeLimit: 200 * 1024 * 1024
      };

      Object.defineProperty(performance, 'memory', {
        value: mockMemory,
        configurable: true
      });

      observer['checkPerformance']();

      expect(consoleSpy).toHaveBeenCalledWith('[HLTB] High memory usage detected');

      consoleSpy.mockRestore();
    });
  });

  describe('Memory Management and Cleanup', () => {
    test('should disconnect all observers on stop', () => {
      const mockObserver = {
        observe: jest.fn(),
        disconnect: jest.fn()
      };
      (MutationObserver as jest.Mock).mockReturnValue(mockObserver);

      observer.start();
      const observerCount = observer['observers'].size;

      observer.stop();

      expect(mockObserver.disconnect).toHaveBeenCalledTimes(observerCount);
      expect(observer['observers'].size).toBe(0);
    });

    test('should unsubscribe from state manager on cleanup', () => {
      const mockUnsubscribe = jest.fn();
      mockStateManager.addListener.mockReturnValue(mockUnsubscribe);

      observer.start();
      observer.stop();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    test('should clear listeners on cleanup', () => {
      observer.addListener(jest.fn());
      observer.addListener(jest.fn());

      observer.stop();

      expect(observer['listeners'].size).toBe(0);
    });

    test('should handle cleanup when observers fail', () => {
      const mockObserver = {
        observe: jest.fn(),
        disconnect: jest.fn().mockImplementation(() => {
          throw new Error('Disconnect error');
        })
      };
      (MutationObserver as jest.Mock).mockReturnValue(mockObserver);

      observer.start();

      expect(() => observer.stop()).not.toThrow();
    });
  });

  describe('Debounced Operations', () => {
    test('should debounce DOM mutation handling', (done) => {
      let callCount = 0;
      const mockListener = jest.fn(() => callCount++);
      observer.addListener(mockListener);
      observer.start();

      // Simulate rapid mutations
      const mutations: MutationRecord[] = Array(5).fill({
        type: 'childList',
        target: document.body,
        addedNodes: [document.createElement('div')],
        removedNodes: [],
        previousSibling: null,
        nextSibling: null,
        attributeName: null,
        attributeNamespace: null,
        oldValue: null
      });

      // Get the mutation callback
      const mutationCallback = (MutationObserver as jest.Mock).mock.calls[0][0];

      // Call multiple times rapidly
      mutations.forEach(() => mutationCallback(mutations));

      // Check that debouncing worked (should only call once after delay)
      setTimeout(() => {
        expect(callCount).toBeLessThan(5); // Should be debounced
        done();
      }, 150);
    });

    test('should handle debounced calls when observer is inactive', (done) => {
      observer.start();
      const mutationCallback = (MutationObserver as jest.Mock).mock.calls[0][0];

      observer.stop(); // Stop observer

      // Trigger debounced function
      mutationCallback([{
        type: 'childList',
        target: document.body,
        addedNodes: [document.createElement('div')],
        removedNodes: [],
        previousSibling: null,
        nextSibling: null,
        attributeName: null,
        attributeNamespace: null,
        oldValue: null
      }]);

      setTimeout(() => {
        // Should not crash or cause issues
        expect(observer.isObserving()).toBe(false);
        done();
      }, 150);
    });
  });

  describe('Integration with StateManager', () => {
    test('should get current state from state manager', () => {
      const state = observer.getCurrentState();
      expect(mockStateManager.getCurrentState).toHaveBeenCalled();
      expect(state).toEqual(mockNavigationState);
    });

    test('should include state manager data in stats', () => {
      const stats = observer.getStats();

      expect(stats.currentUrl).toBe(mockNavigationState.currentUrl);
      expect(stats.isGamePage).toBe(true);
      expect(stats.appId).toBe('730');
    });

    test('should handle state manager errors gracefully', () => {
      mockStateManager.getCurrentState.mockImplementation(() => {
        throw new Error('StateManager error');
      });

      expect(() => observer.getCurrentState()).toThrow('StateManager error');
    });
  });
});