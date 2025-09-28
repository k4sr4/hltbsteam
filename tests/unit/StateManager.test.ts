/**
 * Unit tests for StateManager class
 * Tests navigation tracking, state transitions, performance metrics,
 * error handling, and SPA navigation detection
 */

import { StateManager } from '../../src/content/navigation/StateManager';
import { NavigationState, NavigationType } from '../../src/content/types';
import { mockChromeAPIs } from '../mocks/steamPageMocks';

// Mock the debounce utility
jest.mock('../../src/content/utils/dom', () => ({
  debounce: jest.fn((fn, delay) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  })
}));

describe('StateManager', () => {
  let stateManager: StateManager;

  beforeAll(() => {
    mockChromeAPIs();
  });

  beforeEach(() => {
    // Reset DOM state
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      configurable: true
    });

    // Reset window.location
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://store.steampowered.com/app/730/CounterStrike_2/'
      },
      configurable: true
    });

    stateManager = new StateManager();

    // Mock DOM event listeners to prevent actual event binding
    jest.spyOn(document, 'addEventListener').mockImplementation();
    jest.spyOn(window, 'addEventListener').mockImplementation();
    jest.spyOn(window, 'setInterval').mockImplementation();
  });

  afterEach(() => {
    stateManager.destroy();
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    test('should create initial state correctly', () => {
      const state = stateManager.getCurrentState();

      expect(state.currentUrl).toBe('https://store.steampowered.com/app/730/CounterStrike_2/');
      expect(state.previousUrl).toBe('');
      expect(state.isInitialLoad).toBe(true);
      expect(state.isLoading).toBe(false); // document.readyState is 'complete'
      expect(state.navigationType).toBe(NavigationType.INITIAL_LOAD);
      expect(state.navigationTime).toBeGreaterThan(0);
    });

    test('should handle loading state on initialization', () => {
      Object.defineProperty(document, 'readyState', {
        value: 'loading',
        configurable: true
      });

      const loadingStateManager = new StateManager();
      const state = loadingStateManager.getCurrentState();

      expect(state.isLoading).toBe(true);

      loadingStateManager.destroy();
    });

    test('should set up event listeners on construction', () => {
      expect(document.addEventListener).toHaveBeenCalledWith('readystatechange', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('load', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('pageshow', expect.any(Function));
    });

    test('should initialize once and not repeat', async () => {
      const initSpy = jest.spyOn(stateManager, 'initialize');

      await stateManager.initialize();
      await stateManager.initialize(); // Second call

      expect(initSpy).toHaveBeenCalledTimes(2);
      expect(stateManager['initialized']).toBe(true);
    });
  });

  describe('State Management', () => {
    test('should return immutable state copies', () => {
      const state1 = stateManager.getCurrentState();
      const state2 = stateManager.getCurrentState();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // Different objects

      // Modifying one shouldn't affect the other
      (state1 as any).currentUrl = 'modified';
      expect(state2.currentUrl).not.toBe('modified');
    });

    test('should update state with partial updates', () => {
      const originalState = stateManager.getCurrentState();

      stateManager.updateState({
        currentUrl: 'https://store.steampowered.com/app/440/',
        isLoading: true
      });

      const updatedState = stateManager.getCurrentState();

      expect(updatedState.currentUrl).toBe('https://store.steampowered.com/app/440/');
      expect(updatedState.isLoading).toBe(true);
      expect(updatedState.previousUrl).toBe(originalState.previousUrl); // Unchanged
      expect(updatedState.navigationType).toBe(originalState.navigationType); // Unchanged
    });

    test('should notify listeners on state updates', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      stateManager.addListener(listener1);
      stateManager.addListener(listener2);

      const newState = { currentUrl: 'https://store.steampowered.com/app/440/' };
      stateManager.updateState(newState);

      expect(listener1).toHaveBeenCalledWith(expect.objectContaining(newState));
      expect(listener2).toHaveBeenCalledWith(expect.objectContaining(newState));
    });

    test('should handle listener errors gracefully', () => {
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const workingListener = jest.fn();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      stateManager.addListener(errorListener);
      stateManager.addListener(workingListener);

      stateManager.updateState({ currentUrl: 'test-url' });

      expect(consoleSpy).toHaveBeenCalledWith('[HLTB] Error in state listener:', expect.any(Error));
      expect(workingListener).toHaveBeenCalled(); // Other listeners should still work

      consoleSpy.mockRestore();
    });
  });

  describe('Listener Management', () => {
    test('should add and remove listeners correctly', () => {
      const listener = jest.fn();

      const unsubscribe = stateManager.addListener(listener);
      expect(stateManager['listeners'].has(listener)).toBe(true);

      unsubscribe();
      expect(stateManager['listeners'].has(listener)).toBe(false);
    });

    test('should handle multiple listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

      stateManager.addListener(listener1);
      stateManager.addListener(listener2);
      stateManager.addListener(listener3);

      expect(stateManager['listeners'].size).toBe(3);

      stateManager.removeAllListeners();
      expect(stateManager['listeners'].size).toBe(0);
    });

    test('should return working unsubscribe functions', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      const unsubscribe1 = stateManager.addListener(listener1);
      const unsubscribe2 = stateManager.addListener(listener2);

      unsubscribe1();
      expect(stateManager['listeners'].has(listener1)).toBe(false);
      expect(stateManager['listeners'].has(listener2)).toBe(true);

      unsubscribe2();
      expect(stateManager['listeners'].has(listener2)).toBe(false);
    });
  });

  describe('Game Page Detection', () => {
    test('should detect Steam store game pages', () => {
      const gameUrls = [
        'https://store.steampowered.com/app/730/CounterStrike_2/',
        'https://store.steampowered.com/app/440/Team_Fortress_2/',
        'https://store.steampowered.com/app/570/Dota_2/',
        'https://store.steampowered.com/app/1234567/Some_Game/'
      ];

      gameUrls.forEach(url => {
        stateManager.updateState({ currentUrl: url });
        expect(stateManager.isGamePage()).toBe(true);
      });
    });

    test('should detect Steam community game pages', () => {
      const communityUrls = [
        'https://steamcommunity.com/app/730/discussions/',
        'https://steamcommunity.com/app/440/guides/',
        'https://steamcommunity.com/app/570/workshop/'
      ];

      communityUrls.forEach(url => {
        stateManager.updateState({ currentUrl: url });
        expect(stateManager.isGamePage()).toBe(true);
      });
    });

    test('should not detect non-game pages', () => {
      const nonGameUrls = [
        'https://store.steampowered.com/',
        'https://store.steampowered.com/about/',
        'https://store.steampowered.com/news/',
        'https://steamcommunity.com/market/',
        'https://help.steampowered.com/',
        'https://other-site.com/app/730/'
      ];

      nonGameUrls.forEach(url => {
        stateManager.updateState({ currentUrl: url });
        expect(stateManager.isGamePage()).toBe(false);
      });
    });

    test('should detect game page navigation correctly', () => {
      // Initial non-game page
      stateManager.updateState({
        currentUrl: 'https://store.steampowered.com/',
        previousUrl: ''
      });
      expect(stateManager.isGamePageNavigation()).toBe(false);

      // Navigate to game page
      stateManager.updateState({
        currentUrl: 'https://store.steampowered.com/app/730/',
        previousUrl: 'https://store.steampowered.com/'
      });
      expect(stateManager.isGamePageNavigation()).toBe(true);

      // Navigate to different game page
      stateManager.updateState({
        currentUrl: 'https://store.steampowered.com/app/440/',
        previousUrl: 'https://store.steampowered.com/app/730/'
      });
      expect(stateManager.isGamePageNavigation()).toBe(true);

      // Stay on same game page
      stateManager.updateState({
        currentUrl: 'https://store.steampowered.com/app/440/',
        previousUrl: 'https://store.steampowered.com/app/440/'
      });
      expect(stateManager.isGamePageNavigation()).toBe(false);
    });

    test('should extract app ID correctly', () => {
      const testCases = [
        ['https://store.steampowered.com/app/730/CounterStrike_2/', '730'],
        ['https://store.steampowered.com/app/440/', '440'],
        ['https://steamcommunity.com/app/570/discussions/', '570'],
        ['https://store.steampowered.com/app/1234567/Some_Game/?curator=123', '1234567']
      ];

      testCases.forEach(([url, expectedAppId]) => {
        stateManager.updateState({ currentUrl: url });
        expect(stateManager.getCurrentAppId()).toBe(expectedAppId);
      });
    });

    test('should return null app ID for non-game pages', () => {
      stateManager.updateState({ currentUrl: 'https://store.steampowered.com/' });
      expect(stateManager.getCurrentAppId()).toBeNull();
    });
  });

  describe('Navigation Type Detection', () => {
    test('should detect reload navigation', () => {
      const url = 'https://store.steampowered.com/app/730/';
      const navigationType = stateManager['detectNavigationType'](url, url);
      expect(navigationType).toBe(NavigationType.RELOAD);
    });

    test('should detect back/forward navigation based on timing', () => {
      // Set a recent navigation time
      stateManager['currentState'].navigationTime = Date.now() - 50; // 50ms ago

      const navigationType = stateManager['detectNavigationType'](
        'https://store.steampowered.com/app/440/',
        'https://store.steampowered.com/app/730/'
      );

      expect(navigationType).toBe(NavigationType.BACK_FORWARD);
    });

    test('should default to SPA navigation', () => {
      // Set an old navigation time
      stateManager['currentState'].navigationTime = Date.now() - 1000; // 1 second ago

      const navigationType = stateManager['detectNavigationType'](
        'https://store.steampowered.com/app/440/',
        'https://store.steampowered.com/app/730/'
      );

      expect(navigationType).toBe(NavigationType.SPA_NAVIGATION);
    });
  });

  describe('Navigation Handling', () => {
    test('should handle navigation with state updates', () => {
      const listener = jest.fn();
      stateManager.addListener(listener);

      stateManager['handleNavigation'](
        'https://store.steampowered.com/app/440/',
        'https://store.steampowered.com/app/730/'
      );

      const state = stateManager.getCurrentState();

      expect(state.currentUrl).toBe('https://store.steampowered.com/app/440/');
      expect(state.previousUrl).toBe('https://store.steampowered.com/app/730/');
      expect(state.isInitialLoad).toBe(false);
      expect(state.navigationTime).toBeGreaterThan(0);
      expect(listener).toHaveBeenCalledWith(state);
    });

    test('should handle navigation with specified type', () => {
      stateManager['handleNavigation'](
        'https://store.steampowered.com/app/440/',
        'https://store.steampowered.com/app/730/',
        NavigationType.BACK_FORWARD
      );

      const state = stateManager.getCurrentState();
      expect(state.navigationType).toBe(NavigationType.BACK_FORWARD);
    });

    test('should detect navigation type automatically', () => {
      stateManager['handleNavigation'](
        'https://store.steampowered.com/app/440/',
        'https://store.steampowered.com/app/730/'
      );

      const state = stateManager.getCurrentState();
      expect(Object.values(NavigationType)).toContain(state.navigationType);
    });
  });

  describe('Event Monitoring Setup', () => {
    test('should set up URL change monitoring', () => {
      // MutationObserver should be created for URL monitoring
      expect(global.MutationObserver).toBeDefined();

      // Mock MutationObserver
      const mockObserver = {
        observe: jest.fn(),
        disconnect: jest.fn()
      };
      global.MutationObserver = jest.fn().mockImplementation(() => mockObserver);

      new StateManager();

      expect(MutationObserver).toHaveBeenCalled();
      expect(mockObserver.observe).toHaveBeenCalledWith(document.body, {
        childList: true,
        subtree: true
      });
    });

    test('should set up loading state monitoring', () => {
      expect(document.addEventListener).toHaveBeenCalledWith('readystatechange', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('load', expect.any(Function));
    });

    test('should set up browser navigation monitoring', () => {
      expect(window.addEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('pageshow', expect.any(Function));
    });

    test('should handle pageshow event with persisted flag', () => {
      const pageShowHandler = (window.addEventListener as jest.Mock).mock.calls
        .find(call => call[0] === 'pageshow')?.[1];

      expect(pageShowHandler).toBeDefined();

      // Mock persisted pageshow event
      const mockEvent = { persisted: true };
      const handleNavigationSpy = jest.spyOn(stateManager, 'handleNavigation' as any);

      pageShowHandler(mockEvent);

      expect(handleNavigationSpy).toHaveBeenCalledWith(
        window.location.href,
        stateManager.getCurrentState().currentUrl,
        NavigationType.BACK_FORWARD
      );
    });

    test('should set up periodic URL checking fallback', () => {
      expect(window.setInterval).toHaveBeenCalledWith(expect.any(Function), 1000);
    });
  });

  describe('Initialization Process', () => {
    test('should wait for initial load', async () => {
      Object.defineProperty(document, 'readyState', {
        value: 'loading',
        configurable: true
      });

      const loadPromise = stateManager.initialize();

      // Simulate load event
      setTimeout(() => {
        Object.defineProperty(document, 'readyState', {
          value: 'complete',
          configurable: true
        });
        const loadEvent = new Event('load');
        window.dispatchEvent(loadEvent);
      }, 50);

      await loadPromise;

      expect(stateManager['initialized']).toBe(true);
    });

    test('should timeout initialization if load never completes', async () => {
      Object.defineProperty(document, 'readyState', {
        value: 'loading',
        configurable: true
      });

      // Mock setTimeout to resolve immediately for testing
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn().mockImplementation((fn, delay) => {
        if (delay === 5000) { // The initialization timeout
          fn();
          return 123;
        }
        return originalSetTimeout(fn, delay);
      });

      await stateManager.initialize();

      expect(stateManager['initialized']).toBe(true);

      global.setTimeout = originalSetTimeout;
    });

    test('should notify listeners after initialization', async () => {
      const listener = jest.fn();
      stateManager.addListener(listener);

      await stateManager.initialize();

      expect(listener).toHaveBeenCalledWith(stateManager.getCurrentState());
    });
  });

  describe('Cleanup and Destruction', () => {
    test('should remove all listeners on destroy', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      stateManager.addListener(listener1);
      stateManager.addListener(listener2);

      expect(stateManager['listeners'].size).toBe(2);

      stateManager.destroy();

      expect(stateManager['listeners'].size).toBe(0);
      expect(stateManager['initialized']).toBe(false);
    });

    test('should handle multiple destroy calls gracefully', () => {
      stateManager.destroy();
      expect(() => stateManager.destroy()).not.toThrow();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle invalid URLs gracefully', () => {
      const invalidUrls = [
        '',
        'invalid-url',
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>'
      ];

      invalidUrls.forEach(url => {
        expect(() => {
          stateManager.updateState({ currentUrl: url });
          stateManager.isGamePage();
          stateManager.getCurrentAppId();
        }).not.toThrow();
      });
    });

    test('should handle URL change detection with same URL', () => {
      const url = 'https://store.steampowered.com/app/730/';

      stateManager['handleNavigation'](url, url);

      const state = stateManager.getCurrentState();
      expect(state.navigationType).toBe(NavigationType.RELOAD);
    });

    test('should handle missing app ID in URL', () => {
      stateManager.updateState({ currentUrl: 'https://store.steampowered.com/app/' });
      expect(stateManager.getCurrentAppId()).toBeNull();
    });

    test('should handle malformed app URLs', () => {
      const malformedUrls = [
        'https://store.steampowered.com/app/abc/',
        'https://store.steampowered.com/app///',
        'https://store.steampowered.com/app/123abc/',
      ];

      malformedUrls.forEach(url => {
        stateManager.updateState({ currentUrl: url });
        expect(stateManager.getCurrentAppId()).toBeNull();
      });
    });

    test('should handle state updates during navigation', () => {
      // Simulate rapid state changes
      for (let i = 0; i < 10; i++) {
        stateManager.updateState({
          currentUrl: `https://store.steampowered.com/app/${i}/`,
          navigationTime: Date.now() + i
        });
      }

      const finalState = stateManager.getCurrentState();
      expect(finalState.currentUrl).toBe('https://store.steampowered.com/app/9/');
      expect(finalState.navigationTime).toBeGreaterThan(0);
    });
  });

  describe('Performance Considerations', () => {
    test('should debounce URL change detection', () => {
      const { debounce } = require('../../src/content/utils/dom');

      // Verify debounce was called during setup
      expect(debounce).toHaveBeenCalledWith(expect.any(Function), 100);
    });

    test('should handle high-frequency state updates efficiently', () => {
      const listener = jest.fn();
      stateManager.addListener(listener);

      const startTime = Date.now();

      // Perform many rapid updates
      for (let i = 0; i < 1000; i++) {
        stateManager.updateState({ navigationTime: Date.now() });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete quickly (under 100ms for 1000 updates)
      expect(duration).toBeLessThan(100);
      expect(listener).toHaveBeenCalledTimes(1000);
    });

    test('should handle memory efficiently with many listeners', () => {
      const listeners: Array<() => void> = [];

      // Add many listeners
      for (let i = 0; i < 100; i++) {
        const unsubscribe = stateManager.addListener(() => {});
        listeners.push(unsubscribe);
      }

      expect(stateManager['listeners'].size).toBe(100);

      // Remove all listeners
      listeners.forEach(unsubscribe => unsubscribe());

      expect(stateManager['listeners'].size).toBe(0);
    });
  });
});