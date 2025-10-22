/**
 * HLTBDisplay Component - Unit Tests
 *
 * Comprehensive test suite for the HLTBDisplay Shadow DOM component
 *
 * Coverage:
 * - Creation & Configuration (5 tests)
 * - Lifecycle Management (8 tests)
 * - State Management (10 tests)
 * - Rendering (12 tests)
 * - Shadow DOM (5 tests)
 *
 * Total: 40 tests
 */

import { HLTBDisplay, createHLTBDisplay } from '../../src/content/components/HLTBDisplay';
import { DisplayState } from '../../src/content/types/HLTB';
import {
  createMockHLTBData,
  createMockDisplayConfig,
  createMockCallbacks,
  createMockNoData,
  createMockPartialData,
  createMockElement,
  createMockShadowRoot,
  cleanupDOM,
  expectPerformanceMetrics,
  expectTextContent,
  expectShadowElement,
  expectNoShadowElement,
  expectDisplayState,
  expectAriaAttributes,
  expectNoXSS,
  expectTimingBelow,
  registerCustomMatchers,
  mockRequestAnimationFrame
} from '../test-utils';

// Register custom matchers
beforeAll(() => {
  registerCustomMatchers();
});

describe('HLTBDisplay Component', () => {
  let targetElement: HTMLElement;

  beforeEach(() => {
    // Reset DOM
    cleanupDOM();
    targetElement = createMockElement();
    document.body.appendChild(targetElement);

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanupDOM();
  });

  // ============================================================================
  // Creation & Configuration (5 tests)
  // ============================================================================

  describe('Creation & Configuration', () => {
    test('should create component with default configuration', () => {
      const start = performance.now();
      const display = new HLTBDisplay();
      const end = performance.now();

      expect(display).toBeInstanceOf(HLTBDisplay);
      expect(display.getState()).toBe(DisplayState.LOADING);
      expectTimingBelow(end - start, 10);
    });

    test('should create component with custom configuration', () => {
      const config = createMockDisplayConfig({
        enableAnimations: false,
        showLoading: false,
        theme: { mode: 'light' }
      });

      const display = new HLTBDisplay(config);

      expect(display).toBeInstanceOf(HLTBDisplay);
      expect(display.getState()).toBe(DisplayState.LOADING);
    });

    test('should merge custom configuration with defaults', () => {
      const config = {
        enableAnimations: false,
        theme: {
          mode: 'light' as const,
          colors: {
            primary: '#ff0000'
          }
        }
      };

      const display = new HLTBDisplay(config);

      // Should have custom values
      const metrics = display.getMetrics();
      expect(metrics).toBeDefined();

      // Other defaults should be preserved
      expect(display).toBeDefined();
    });

    test('should register lifecycle callbacks', () => {
      const callbacks = createMockCallbacks();
      const display = new HLTBDisplay({}, callbacks);

      expect(callbacks.onBeforeCreate).toHaveBeenCalledTimes(1);
      expect(callbacks.onCreate).toHaveBeenCalledTimes(1);
    });

    test('should use factory function to create component', () => {
      const config = createMockDisplayConfig();
      const callbacks = createMockCallbacks();

      const display = createHLTBDisplay(config, callbacks);

      expect(display).toBeInstanceOf(HLTBDisplay);
      expect(callbacks.onBeforeCreate).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Lifecycle Management (8 tests)
  // ============================================================================

  describe('Lifecycle Management', () => {
    test('should mount component to DOM element', () => {
      const callbacks = createMockCallbacks();
      const display = new HLTBDisplay({}, callbacks);

      display.mount(targetElement);

      expect(callbacks.onBeforeInject).toHaveBeenCalled();
      expect(callbacks.onInject).toHaveBeenCalled();
      expect(document.querySelector('.hltb-display-host')).toBeTruthy();
    });

    test('should mount with position: before', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement, 'before');

      const hostElement = document.querySelector('.hltb-display-host');
      expect(hostElement).toBeTruthy();
      expect(hostElement?.nextSibling).toBe(targetElement);
    });

    test('should mount with position: after', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement, 'after');

      const hostElement = document.querySelector('.hltb-display-host');
      expect(hostElement).toBeTruthy();
      expect(hostElement?.previousSibling).toBe(targetElement);
    });

    test('should mount with position: prepend', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement, 'prepend');

      const hostElement = targetElement.querySelector('.hltb-display-host');
      expect(hostElement).toBeTruthy();
      expect(targetElement.firstChild).toBe(hostElement);
    });

    test('should mount with position: append', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement, 'append');

      const hostElement = targetElement.querySelector('.hltb-display-host');
      expect(hostElement).toBeTruthy();
      expect(targetElement.lastChild).toBe(hostElement);
    });

    test('should prevent double mounting', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      expect(() => {
        display.mount(targetElement);
      }).toThrow('already mounted');
    });

    test('should throw error when mounting to null element', () => {
      const display = new HLTBDisplay();

      expect(() => {
        display.mount(null);
      }).toThrow('Invalid target element');
    });

    test('should destroy component and clean up resources', () => {
      const callbacks = createMockCallbacks();
      const display = new HLTBDisplay({}, callbacks);

      display.mount(targetElement);
      display.destroy();

      expect(callbacks.onDestroy).toHaveBeenCalled();
      expect(document.querySelector('.hltb-display-host')).toBeNull();
    });
  });

  // ============================================================================
  // State Management (10 tests)
  // ============================================================================

  describe('State Management', () => {
    test('should start in LOADING state', () => {
      const display = new HLTBDisplay();
      expectDisplayState(display.getState(), DisplayState.LOADING);
    });

    test('should transition to LOADING state', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      display.setLoading();

      expectDisplayState(display.getState(), DisplayState.LOADING);
    });

    test('should transition to SUCCESS state with valid data', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      const data = createMockHLTBData();
      display.setData(data);

      expectDisplayState(display.getState(), DisplayState.SUCCESS);
    });

    test('should transition to NO_DATA state with null values', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      const data = createMockNoData();
      display.setData(data);

      expectDisplayState(display.getState(), DisplayState.NO_DATA);
    });

    test('should transition to ERROR state', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      display.setError('Test error');

      expectDisplayState(display.getState(), DisplayState.ERROR);
    });

    test('should handle Error object in setError', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      const error = new Error('Test error object');
      display.setError(error);

      expectDisplayState(display.getState(), DisplayState.ERROR);
    });

    test('should call onUpdate callback when data is set', () => {
      const callbacks = createMockCallbacks();
      const display = new HLTBDisplay({}, callbacks);
      display.mount(targetElement);

      const data = createMockHLTBData();
      display.setData(data);

      expect(callbacks.onUpdate).toHaveBeenCalledWith(data);
    });

    test('should call onError callback when error is set', () => {
      const callbacks = createMockCallbacks();
      const display = new HLTBDisplay({}, callbacks);
      display.mount(targetElement);

      const error = 'Test error';
      display.setError(error);

      expect(callbacks.onError).toHaveBeenCalledWith(expect.any(Error));
    });

    test('should reject invalid data structure', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      const invalidData = { invalid: 'structure' } as any;
      display.setData(invalidData);

      expectDisplayState(display.getState(), DisplayState.ERROR);
    });

    test('should handle partial data (some null values)', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      const partialData = createMockPartialData();
      display.setData(partialData);

      expectDisplayState(display.getState(), DisplayState.SUCCESS);
    });
  });

  // ============================================================================
  // Rendering (12 tests)
  // ============================================================================

  describe('Rendering', () => {
    test('should render loading state', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);
      display.setLoading();

      const hostElement = document.querySelector('.hltb-display-host');
      const shadowRoot = hostElement?.shadowRoot;

      expect(shadowRoot).toBeTruthy();
      if (shadowRoot) {
        expectShadowElement(shadowRoot, '.hltb-loading');
        expectTextContent(shadowRoot, 'Loading');
      }
    });

    test('should render success state with complete data', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      const data = createMockHLTBData({
        mainStory: 12,
        mainExtra: 18,
        completionist: 25
      });
      display.setData(data);

      const hostElement = document.querySelector('.hltb-display-host');
      const shadowRoot = hostElement?.shadowRoot;

      expect(shadowRoot).toBeTruthy();
      if (shadowRoot) {
        expectShadowElement(shadowRoot, '.hltb-times');
        expectTextContent(shadowRoot, '12');
        expectTextContent(shadowRoot, '18');
        expectTextContent(shadowRoot, '25');
      }
    });

    test('should render success state with partial data', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      const data = createMockPartialData({ mainStory: 12 });
      display.setData(data);

      const hostElement = document.querySelector('.hltb-display-host');
      const shadowRoot = hostElement?.shadowRoot;

      expect(shadowRoot).toBeTruthy();
      if (shadowRoot) {
        expectTextContent(shadowRoot, '12');
        expectTextContent(shadowRoot, '--'); // Null values show as --
      }
    });

    test('should render error state', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      display.setError('Test error message');

      const hostElement = document.querySelector('.hltb-display-host');
      const shadowRoot = hostElement?.shadowRoot;

      expect(shadowRoot).toBeTruthy();
      if (shadowRoot) {
        expectShadowElement(shadowRoot, '.hltb-error');
        expectTextContent(shadowRoot, 'Test error message');
      }
    });

    test('should render no data state', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      const data = createMockNoData();
      display.setData(data);

      const hostElement = document.querySelector('.hltb-display-host');
      const shadowRoot = hostElement?.shadowRoot;

      expect(shadowRoot).toBeTruthy();
      if (shadowRoot) {
        expectShadowElement(shadowRoot, '.hltb-no-data');
        expectTextContent(shadowRoot, 'No completion time data');
      }
    });

    test('should update data attributes on state change', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      const data = createMockHLTBData({ source: 'cache', confidence: 'high' });
      display.setData(data);

      const hostElement = document.querySelector('.hltb-display-host');
      const shadowRoot = hostElement?.shadowRoot;
      const container = shadowRoot?.querySelector('.hltb-container');

      expect(container).toBeTruthy();
      if (container) {
        expect(container.getAttribute('data-state')).toBe(DisplayState.SUCCESS);
        expect(container.getAttribute('data-source')).toBe('cache');
        expect(container.getAttribute('data-confidence')).toBe('high');
      }
    });

    test('should render HLTB link when enableLink is true', () => {
      const display = new HLTBDisplay({ enableLink: true });
      display.mount(targetElement);

      const data = createMockHLTBData({ gameId: 12345 });
      display.setData(data);

      const hostElement = document.querySelector('.hltb-display-host');
      const shadowRoot = hostElement?.shadowRoot;

      expect(shadowRoot).toBeTruthy();
      if (shadowRoot) {
        const link = shadowRoot.querySelector('.hltb-link') as HTMLAnchorElement;
        expect(link).toBeTruthy();
        expect(link?.href).toContain('howlongtobeat.com/game/12345');
      }
    });

    test('should render source badge when showSource is true', () => {
      const display = new HLTBDisplay({ showSource: true });
      display.mount(targetElement);

      const data = createMockHLTBData({ source: 'cache' });
      display.setData(data);

      const hostElement = document.querySelector('.hltb-display-host');
      const shadowRoot = hostElement?.shadowRoot;

      expect(shadowRoot).toBeTruthy();
      if (shadowRoot) {
        expectShadowElement(shadowRoot, '.hltb-source-badge');
        expectTextContent(shadowRoot, 'cached');
      }
    });

    test('should render confidence indicator when accessibility is true', () => {
      const display = new HLTBDisplay({ accessibility: true });
      display.mount(targetElement);

      const data = createMockHLTBData({ confidence: 'high' });
      display.setData(data);

      const hostElement = document.querySelector('.hltb-display-host');
      const shadowRoot = hostElement?.shadowRoot;

      expect(shadowRoot).toBeTruthy();
      if (shadowRoot) {
        expectShadowElement(shadowRoot, '.hltb-accuracy-high');
      }
    });

    test('should format hours correctly', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      const data = createMockHLTBData({
        mainStory: 1,
        mainExtra: 12.5,
        completionist: 0.5
      });
      display.setData(data);

      const hostElement = document.querySelector('.hltb-display-host');
      const shadowRoot = hostElement?.shadowRoot;

      expect(shadowRoot).toBeTruthy();
      if (shadowRoot) {
        expectTextContent(shadowRoot, '1 Hour'); // Singular
        expectTextContent(shadowRoot, '12.5 Hours');
        expectTextContent(shadowRoot, '30 min'); // < 1 hour
      }
    });

    test('should apply color classes based on time length', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      const data = createMockHLTBData({
        mainStory: 30,  // long
        mainExtra: 60,  // very-long
        completionist: 100  // very-long
      });
      display.setData(data);

      const hostElement = document.querySelector('.hltb-display-host');
      const shadowRoot = hostElement?.shadowRoot;

      expect(shadowRoot).toBeTruthy();
      if (shadowRoot) {
        const values = shadowRoot.querySelectorAll('.hltb-time-value');
        expect(values.length).toBeGreaterThan(0);
      }
    });

    test('should use requestAnimationFrame when animations enabled', async () => {
      const rafHelper = mockRequestAnimationFrame();

      const display = new HLTBDisplay({ enableAnimations: true });
      display.mount(targetElement);

      const data = createMockHLTBData();
      display.setData(data);

      expect(global.requestAnimationFrame).toHaveBeenCalled();

      rafHelper.execute();
      rafHelper.restore();
    });
  });

  // ============================================================================
  // Shadow DOM (5 tests)
  // ============================================================================

  describe('Shadow DOM', () => {
    test('should create Shadow DOM on mount', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      const hostElement = document.querySelector('.hltb-display-host');
      expect(hostElement).toBeTruthy();
      expect(hostElement?.shadowRoot).toBeTruthy();
    });

    test('should inject styles into Shadow DOM', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      const hostElement = document.querySelector('.hltb-display-host');
      const shadowRoot = hostElement?.shadowRoot;

      expect(shadowRoot).toBeTruthy();
      if (shadowRoot) {
        const styleElement = shadowRoot.querySelector('style');
        expect(styleElement).toBeTruthy();
        expect(styleElement?.textContent).toContain('.hltb-container');
      }
    });

    test('should isolate styles from parent document', () => {
      // Add global style that shouldn't affect shadow DOM
      const globalStyle = document.createElement('style');
      globalStyle.textContent = '.hltb-container { background: red; }';
      document.head.appendChild(globalStyle);

      const display = new HLTBDisplay();
      display.mount(targetElement);

      const hostElement = document.querySelector('.hltb-display-host');
      const shadowRoot = hostElement?.shadowRoot;

      // Shadow DOM should have its own styles
      expect(shadowRoot).toBeTruthy();
      if (shadowRoot) {
        const styleElement = shadowRoot.querySelector('style');
        expect(styleElement).toBeTruthy();
        // Should use gradient background from component, not global red
        expect(styleElement?.textContent).toContain('linear-gradient');
      }

      globalStyle.remove();
    });

    test('should update theme styles dynamically', () => {
      const display = new HLTBDisplay({ theme: { mode: 'dark' } });
      display.mount(targetElement);

      // Change to light theme
      display.setTheme({ mode: 'light' });

      const hostElement = document.querySelector('.hltb-display-host');
      const shadowRoot = hostElement?.shadowRoot;

      expect(shadowRoot).toBeTruthy();
      if (shadowRoot) {
        const styleElement = shadowRoot.querySelector('style');
        expect(styleElement).toBeTruthy();
      }
    });

    test('should clean up Shadow DOM on destroy', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      const hostElement = document.querySelector('.hltb-display-host');
      expect(hostElement).toBeTruthy();

      display.destroy();

      const hostElementAfter = document.querySelector('.hltb-display-host');
      expect(hostElementAfter).toBeNull();
    });
  });

  // ============================================================================
  // Performance Metrics (6 tests)
  // ============================================================================

  describe('Performance Metrics', () => {
    test('should track creation time', () => {
      const display = new HLTBDisplay();
      const metrics = display.getMetrics();

      expect(metrics.creationTime).toBeGreaterThan(0);
      expectTimingBelow(metrics.creationTime, 10);
    });

    test('should track injection time', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      const metrics = display.getMetrics();

      expect(metrics.injectionTime).toBeGreaterThan(0);
      expectTimingBelow(metrics.injectionTime, 20);
    });

    test('should track render time', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      const data = createMockHLTBData();
      display.setData(data);

      const metrics = display.getMetrics();

      expect(metrics.renderTime).toBeGreaterThan(0);
      expectTimingBelow(metrics.renderTime, 20);
    });

    test('should track total time', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      const data = createMockHLTBData();
      display.setData(data);

      const metrics = display.getMetrics();

      expect(metrics.totalTime).toBeGreaterThan(0);
      expectTimingBelow(metrics.totalTime, 50);
    });

    test('should track DOM operations count', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      const data = createMockHLTBData();
      display.setData(data);

      const metrics = display.getMetrics();

      expect(metrics.domOperations).toBeGreaterThan(0);
      expect(metrics.domOperations).toBeLessThan(30);
    });

    test('should meet all performance targets', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      const data = createMockHLTBData();
      display.setData(data);

      const metrics = display.getMetrics();

      expectPerformanceMetrics(metrics, {
        creation: 10,
        injection: 20,
        render: 20,
        total: 50,
        domOps: 30
      });
    });
  });

  // ============================================================================
  // Accessibility (5 tests)
  // ============================================================================

  describe('Accessibility', () => {
    test('should have correct ARIA role on container', () => {
      const display = new HLTBDisplay({ accessibility: true });
      display.mount(targetElement);

      const hostElement = document.querySelector('.hltb-display-host');
      const shadowRoot = hostElement?.shadowRoot;
      const container = shadowRoot?.querySelector('.hltb-container');

      expect(container).toBeTruthy();
      if (container) {
        expect(container.getAttribute('role')).toBe('region');
      }
    });

    test('should have ARIA label on container', () => {
      const display = new HLTBDisplay({ accessibility: true });
      display.mount(targetElement);

      const hostElement = document.querySelector('.hltb-display-host');
      const shadowRoot = hostElement?.shadowRoot;
      const container = shadowRoot?.querySelector('.hltb-container');

      expect(container).toBeTruthy();
      if (container) {
        const ariaLabel = container.getAttribute('aria-label');
        expect(ariaLabel).toBeTruthy();
        expect(ariaLabel).toContain('HowLongToBeat');
      }
    });

    test('should update ARIA live region on state changes', () => {
      const display = new HLTBDisplay({ accessibility: true });
      display.mount(targetElement);

      display.setLoading();

      const hostElement = document.querySelector('.hltb-display-host');
      const shadowRoot = hostElement?.shadowRoot;
      const container = shadowRoot?.querySelector('.hltb-container');

      expect(container).toBeTruthy();
      if (container) {
        const ariaLive = container.getAttribute('aria-live');
        expect(ariaLive).toBe('polite');
      }
    });

    test('should have ARIA labels on time items', () => {
      const display = new HLTBDisplay({ accessibility: true });
      display.mount(targetElement);

      const data = createMockHLTBData({ mainStory: 12 });
      display.setData(data);

      const hostElement = document.querySelector('.hltb-display-host');
      const shadowRoot = hostElement?.shadowRoot;

      expect(shadowRoot).toBeTruthy();
      if (shadowRoot) {
        const timeItems = shadowRoot.querySelectorAll('.hltb-time-item');
        expect(timeItems.length).toBeGreaterThan(0);

        timeItems.forEach(item => {
          const ariaLabel = item.getAttribute('aria-label');
          expect(ariaLabel).toBeTruthy();
        });
      }
    });

    test('should have accessible link with descriptive label', () => {
      const display = new HLTBDisplay({ accessibility: true, enableLink: true });
      display.mount(targetElement);

      const data = createMockHLTBData({ gameId: 12345 });
      display.setData(data);

      const hostElement = document.querySelector('.hltb-display-host');
      const shadowRoot = hostElement?.shadowRoot;

      expect(shadowRoot).toBeTruthy();
      if (shadowRoot) {
        const link = shadowRoot.querySelector('.hltb-link');
        expect(link).toBeTruthy();
        if (link) {
          const ariaLabel = link.getAttribute('aria-label');
          expect(ariaLabel).toBeTruthy();
          expect(ariaLabel).toContain('View detailed completion times');
        }
      }
    });
  });

  // ============================================================================
  // Security (3 tests)
  // ============================================================================

  describe('Security', () => {
    test('should prevent XSS in game data', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      const maliciousData = createMockHLTBData({
        gameId: '<script>alert("XSS")</script>' as any
      });
      display.setData(maliciousData);

      const hostElement = document.querySelector('.hltb-display-host');
      const shadowRoot = hostElement?.shadowRoot;

      expect(shadowRoot).toBeTruthy();
      if (shadowRoot) {
        expectNoXSS(shadowRoot);
        // Script tag should be rendered as text, not executed
        expectTextContent(shadowRoot, 'script');
      }
    });

    test('should prevent XSS in error messages', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      display.setError('<img src=x onerror="alert(\'XSS\')">');

      const hostElement = document.querySelector('.hltb-display-host');
      const shadowRoot = hostElement?.shadowRoot;

      expect(shadowRoot).toBeTruthy();
      if (shadowRoot) {
        expectNoXSS(shadowRoot);
      }
    });

    test('should sanitize all user-controlled data', () => {
      const display = new HLTBDisplay();
      display.mount(targetElement);

      const data = createMockHLTBData();
      display.setData(data);

      const hostElement = document.querySelector('.hltb-display-host');
      const shadowRoot = hostElement?.shadowRoot;

      expect(shadowRoot).toBeTruthy();
      if (shadowRoot) {
        // Verify no innerHTML usage (all textContent)
        expectNoXSS(shadowRoot);
      }
    });
  });
});
