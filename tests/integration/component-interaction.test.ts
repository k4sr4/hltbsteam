/**
 * Component Interaction - Integration Tests
 *
 * Tests for component integration and data flows
 *
 * Coverage:
 * - HLTBDisplay + InjectionManager integration
 * - Content Script + InjectionManager integration
 * - Theme propagation
 * - Error propagation
 * - Cleanup cascade
 *
 * Total: 10 integration tests
 */

import { HLTBDisplay } from '../../src/content/components/HLTBDisplay';
import { InjectionManager } from '../../src/content/managers/InjectionManager';
import {
  setupStorePageDOM,
  cleanupDOM,
  createMockHLTBData,
  createMockDisplayConfig,
  createMockCallbacks,
  flushPromises,
  waitFor
} from '../test-utils';

describe('Component Interaction Integration', () => {
  beforeEach(() => {
    cleanupDOM();
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanupDOM();
  });

  test('InjectionManager should successfully create and mount HLTBDisplay', async () => {
    setupStorePageDOM();

    const manager = new InjectionManager({
      displayConfig: createMockDisplayConfig()
    });

    const data = createMockHLTBData();
    const result = await manager.injectHLTBData(data);

    expect(result).toBe(true);

    // Display should be mounted in DOM
    await waitFor(() => document.querySelector('.hltb-display-host') !== null);

    const hostElement = document.querySelector('.hltb-display-host');
    expect(hostElement).toBeTruthy();
    expect(hostElement?.shadowRoot).toBeTruthy();
  });

  test('should propagate theme configuration to display component', async () => {
    setupStorePageDOM();

    const themeConfig = { mode: 'light' as const };
    const manager = new InjectionManager({
      displayConfig: { theme: themeConfig }
    });

    const data = createMockHLTBData();
    await manager.injectHLTBData(data);

    const hostElement = document.querySelector('.hltb-display-host');
    const shadowRoot = hostElement?.shadowRoot;
    const container = shadowRoot?.querySelector('.hltb-container');

    expect(container).toBeTruthy();
    if (container) {
      expect(container.getAttribute('data-theme')).toBe('light');
    }
  });

  test('should propagate callbacks through component chain', async () => {
    setupStorePageDOM();

    const callbacks = createMockCallbacks();
    const manager = new InjectionManager({
      callbacks
    });

    const data = createMockHLTBData();
    await manager.injectHLTBData(data);

    // onCreate should be called
    expect(callbacks.onCreate).toHaveBeenCalled();
  });

  test('should propagate errors from display to manager', async () => {
    setupStorePageDOM();

    const manager = new InjectionManager();
    const data = createMockHLTBData();

    await manager.injectHLTBData(data);

    // Show error
    manager.showError('Test error');

    const hostElement = document.querySelector('.hltb-display-host');
    const shadowRoot = hostElement?.shadowRoot;

    expect(shadowRoot).toBeTruthy();
    if (shadowRoot) {
      const errorElement = shadowRoot.querySelector('.hltb-error');
      expect(errorElement).toBeTruthy();
    }
  });

  test('should cascade cleanup from manager to display', async () => {
    setupStorePageDOM();

    const manager = new InjectionManager();
    const data = createMockHLTBData();

    await manager.injectHLTBData(data);

    const hostElementBefore = document.querySelector('.hltb-display-host');
    expect(hostElementBefore).toBeTruthy();

    manager.destroy();

    const hostElementAfter = document.querySelector('.hltb-display-host');
    expect(hostElementAfter).toBeNull();
  });

  test('should update display data through manager', async () => {
    setupStorePageDOM();

    const manager = new InjectionManager();
    const data1 = createMockHLTBData({ mainStory: 10 });
    const data2 = createMockHLTBData({ mainStory: 12 });

    await manager.injectHLTBData(data1);

    let shadowRoot = document.querySelector('.hltb-display-host')?.shadowRoot;
    expect(shadowRoot?.textContent).toContain('10');

    manager.updateData(data2);
    await flushPromises();

    shadowRoot = document.querySelector('.hltb-display-host')?.shadowRoot;
    expect(shadowRoot?.textContent).toContain('12');
  });

  test('should aggregate performance metrics across components', async () => {
    setupStorePageDOM();

    const manager = new InjectionManager();
    const data = createMockHLTBData();

    await manager.injectHLTBData(data);

    const metrics = manager.getMetrics();

    expect(metrics).toBeDefined();
    if (metrics) {
      expect(metrics.totalTime).toBeGreaterThan(0);
      expect(metrics.domOperations).toBeGreaterThan(0);
    }
  });

  test('should handle re-injection with cleanup of previous instance', async () => {
    setupStorePageDOM();

    const manager = new InjectionManager();
    const data1 = createMockHLTBData();
    const data2 = createMockHLTBData();

    await manager.injectHLTBData(data1);
    const firstHost = document.querySelector('.hltb-display-host');

    await manager.injectHLTBData(data2);
    const secondHost = document.querySelector('.hltb-display-host');

    // Should only have one host element (first cleaned up)
    const allHosts = document.querySelectorAll('.hltb-display-host');
    expect(allHosts.length).toBe(1);
  });

  test('should synchronize state across manager and display', async () => {
    setupStorePageDOM();

    const manager = new InjectionManager();
    const data = createMockHLTBData();

    await manager.injectHLTBData(data);

    manager.showLoading();
    await flushPromises();

    let shadowRoot = document.querySelector('.hltb-display-host')?.shadowRoot;
    expect(shadowRoot?.querySelector('.hltb-loading')).toBeTruthy();

    manager.updateData(data);
    await flushPromises();

    shadowRoot = document.querySelector('.hltb-display-host')?.shadowRoot;
    expect(shadowRoot?.querySelector('.hltb-times')).toBeTruthy();
  });

  test('should handle concurrent operations gracefully', async () => {
    setupStorePageDOM();

    const manager = new InjectionManager();
    const data1 = createMockHLTBData({ mainStory: 10 });
    const data2 = createMockHLTBData({ mainStory: 12 });

    // Start concurrent operations
    const promise1 = manager.injectHLTBData(data1);
    const promise2 = manager.injectHLTBData(data2);

    await Promise.all([promise1, promise2]);

    // Should have handled both (second should replace first)
    const hostElements = document.querySelectorAll('.hltb-display-host');
    expect(hostElements.length).toBe(1);
  });
});
