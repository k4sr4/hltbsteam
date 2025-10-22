/**
 * InjectionManager - Unit Tests
 *
 * Comprehensive test suite for the InjectionManager component
 *
 * Coverage:
 * - Initialization (3 tests)
 * - Injection Point Discovery (8 tests)
 * - Component Lifecycle (6 tests)
 * - Auto Re-injection (4 tests)
 * - Error Handling (4 tests)
 *
 * Total: 25 tests
 */

import { InjectionManager, createInjectionManager } from '../../src/content/managers/InjectionManager';
import { HLTBDisplay } from '../../src/content/components/HLTBDisplay';
import {
  createMockHLTBData,
  createMockDisplayConfig,
  createMockCallbacks,
  createMockInjectionPoint,
  createMockNoData,
  setupStorePageDOM,
  setupCommunityPageDOM,
  setupEmptyPageDOM,
  cleanupDOM,
  createInjectionTarget,
  waitFor,
  expectTextContent
} from '../test-utils';

// Mock the HLTBDisplay component
jest.mock('../../src/content/components/HLTBDisplay', () => {
  return {
    HLTBDisplay: jest.fn().mockImplementation(() => ({
      mount: jest.fn(),
      setData: jest.fn(),
      setLoading: jest.fn(),
      setError: jest.fn(),
      destroy: jest.fn(),
      getMetrics: jest.fn(() => ({
        creationTime: 5,
        injectionTime: 10,
        renderTime: 8,
        totalTime: 23,
        domOperations: 15
      })),
      getState: jest.fn()
    })),
    createHLTBDisplay: jest.fn().mockImplementation(() => ({
      mount: jest.fn(),
      setData: jest.fn(),
      setLoading: jest.fn(),
      setError: jest.fn(),
      destroy: jest.fn(),
      getMetrics: jest.fn(() => ({
        creationTime: 5,
        injectionTime: 10,
        renderTime: 8,
        totalTime: 23,
        domOperations: 15
      })),
      getState: jest.fn()
    }))
  };
});

describe('InjectionManager', () => {
  beforeEach(() => {
    cleanupDOM();
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanupDOM();
  });

  // ============================================================================
  // Initialization (3 tests)
  // ============================================================================

  describe('Initialization', () => {
    test('should create manager with default configuration', () => {
      const manager = new InjectionManager();

      expect(manager).toBeInstanceOf(InjectionManager);
      expect(manager.isActive()).toBe(true);
    });

    test('should create manager with custom configuration', () => {
      const config = {
        displayConfig: createMockDisplayConfig({ theme: { mode: 'light' } }),
        autoReinject: false,
        debug: true
      };

      const manager = new InjectionManager(config);

      expect(manager).toBeInstanceOf(InjectionManager);
      expect(manager.isActive()).toBe(true);
    });

    test('should use factory function to create manager', () => {
      const config = {
        displayConfig: createMockDisplayConfig(),
        callbacks: createMockCallbacks()
      };

      const manager = createInjectionManager(config);

      expect(manager).toBeInstanceOf(InjectionManager);
    });
  });

  // ============================================================================
  // Injection Point Discovery (8 tests)
  // ============================================================================

  describe('Injection Point Discovery', () => {
    test('should find injection point on Store page', async () => {
      setupStorePageDOM();

      const manager = new InjectionManager();
      const data = createMockHLTBData();

      const result = await manager.injectHLTBData(data);

      expect(result).toBe(true);
      expect(HLTBDisplay).toHaveBeenCalled();
    });

    test('should find injection point on Community page', async () => {
      setupCommunityPageDOM();

      const manager = new InjectionManager();
      const data = createMockHLTBData();

      const result = await manager.injectHLTBData(data);

      expect(result).toBe(true);
      expect(HLTBDisplay).toHaveBeenCalled();
    });

    test('should select highest priority injection point', async () => {
      setupStorePageDOM();

      // Add multiple injection targets
      const target1 = createInjectionTarget('game_area_purchase');
      const target2 = createInjectionTarget('game_details');

      const manager = new InjectionManager();
      const data = createMockHLTBData();

      await manager.injectHLTBData(data);

      // Should use highest priority (game_area_purchase)
      const mockDisplay = (HLTBDisplay as jest.Mock).mock.results[0].value;
      expect(mockDisplay.mount).toHaveBeenCalled();
    });

    test('should use fallback injection point when primary not available', async () => {
      setupStorePageDOM();

      // Remove primary injection point
      const primaryElement = document.querySelector('.game_area_purchase');
      primaryElement?.remove();

      const manager = new InjectionManager();
      const data = createMockHLTBData();

      const result = await manager.injectHLTBData(data);

      expect(result).toBe(true);
      expect(HLTBDisplay).toHaveBeenCalled();
    });

    test('should return false when no valid injection point exists', async () => {
      setupEmptyPageDOM();

      const manager = new InjectionManager();
      const data = createMockHLTBData();

      const result = await manager.injectHLTBData(data);

      expect(result).toBe(false);
      expect(HLTBDisplay).not.toHaveBeenCalled();
    });

    test('should use custom injection points with higher priority', async () => {
      setupStorePageDOM();

      const customPoint = createMockInjectionPoint({
        selector: '.custom-target',
        priority: 0  // Highest priority
      });

      // Add custom target to DOM
      const customElement = document.createElement('div');
      customElement.className = 'custom-target';
      document.body.appendChild(customElement);

      const manager = new InjectionManager({
        customInjectionPoints: [customPoint]
      });

      const data = createMockHLTBData();
      await manager.injectHLTBData(data);

      const mockDisplay = (HLTBDisplay as jest.Mock).mock.results[0].value;
      expect(mockDisplay.mount).toHaveBeenCalled();
    });

    test('should evaluate condition function for injection point', async () => {
      setupStorePageDOM();

      const conditionFn = jest.fn(() => false);
      const customPoint = createMockInjectionPoint({
        selector: '.game_area_purchase',
        priority: 0,
        condition: conditionFn
      });

      const manager = new InjectionManager({
        customInjectionPoints: [customPoint]
      });

      const data = createMockHLTBData();
      await manager.injectHLTBData(data);

      expect(conditionFn).toHaveBeenCalled();
    });

    test('should skip injection point when condition returns false', async () => {
      setupStorePageDOM();

      const customPoint = createMockInjectionPoint({
        selector: '.game_area_purchase',
        priority: 0,
        condition: () => false  // Fails condition
      });

      const manager = new InjectionManager({
        customInjectionPoints: [customPoint]
      });

      const data = createMockHLTBData();
      const result = await manager.injectHLTBData(data);

      // Should fall back to default injection points
      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // Component Lifecycle (6 tests)
  // ============================================================================

  describe('Component Lifecycle', () => {
    test('should inject HLTB data successfully', async () => {
      setupStorePageDOM();

      const manager = new InjectionManager();
      const data = createMockHLTBData();

      const result = await manager.injectHLTBData(data);

      expect(result).toBe(true);

      const mockDisplay = (HLTBDisplay as jest.Mock).mock.results[0].value;
      expect(mockDisplay.mount).toHaveBeenCalled();
      expect(mockDisplay.setData).toHaveBeenCalledWith(data);
    });

    test('should show loading state', async () => {
      setupStorePageDOM();

      const manager = new InjectionManager();
      const data = createMockHLTBData();

      await manager.injectHLTBData(data);
      manager.showLoading();

      const mockDisplay = (HLTBDisplay as jest.Mock).mock.results[0].value;
      expect(mockDisplay.setLoading).toHaveBeenCalled();
    });

    test('should show error state', async () => {
      setupStorePageDOM();

      const manager = new InjectionManager();
      const data = createMockHLTBData();

      await manager.injectHLTBData(data);
      manager.showError('Test error');

      const mockDisplay = (HLTBDisplay as jest.Mock).mock.results[0].value;
      expect(mockDisplay.setError).toHaveBeenCalledWith('Test error');
    });

    test('should update existing data', async () => {
      setupStorePageDOM();

      const manager = new InjectionManager();
      const data1 = createMockHLTBData({ mainStory: 10 });
      const data2 = createMockHLTBData({ mainStory: 12 });

      await manager.injectHLTBData(data1);
      manager.updateData(data2);

      const mockDisplay = (HLTBDisplay as jest.Mock).mock.results[0].value;
      expect(mockDisplay.setData).toHaveBeenCalledWith(data2);
    });

    test('should cleanup current display before new injection', async () => {
      setupStorePageDOM();

      const manager = new InjectionManager();
      const data1 = createMockHLTBData();
      const data2 = createMockHLTBData();

      await manager.injectHLTBData(data1);
      const firstDisplay = (HLTBDisplay as jest.Mock).mock.results[0].value;

      await manager.injectHLTBData(data2);

      expect(firstDisplay.destroy).toHaveBeenCalled();
      expect(HLTBDisplay).toHaveBeenCalledTimes(2);
    });

    test('should destroy manager and cleanup resources', async () => {
      setupStorePageDOM();

      const manager = new InjectionManager();
      const data = createMockHLTBData();

      await manager.injectHLTBData(data);
      manager.destroy();

      expect(manager.isActive()).toBe(false);

      const mockDisplay = (HLTBDisplay as jest.Mock).mock.results[0].value;
      expect(mockDisplay.destroy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Auto Re-injection (4 tests)
  // ============================================================================

  describe('Auto Re-injection', () => {
    test('should setup mutation observer when autoReinject is true', async () => {
      setupStorePageDOM();

      const manager = new InjectionManager({ autoReinject: true });
      const data = createMockHLTBData();

      await manager.injectHLTBData(data);

      // Mutation observer should be created
      expect(MutationObserver).toHaveBeenCalled();
    });

    test('should not setup mutation observer when autoReinject is false', async () => {
      setupStorePageDOM();

      const manager = new InjectionManager({ autoReinject: false });
      const data = createMockHLTBData();

      await manager.injectHLTBData(data);

      // Mutation observer should not be created
      expect(MutationObserver).not.toHaveBeenCalled();
    });

    test('should disconnect observer on cleanup', async () => {
      setupStorePageDOM();

      const mockDisconnect = jest.fn();
      (global.MutationObserver as jest.Mock).mockImplementation(() => ({
        observe: jest.fn(),
        disconnect: mockDisconnect,
        takeRecords: jest.fn(() => [])
      }));

      const manager = new InjectionManager({ autoReinject: true });
      const data = createMockHLTBData();

      await manager.injectHLTBData(data);
      manager.cleanup();

      expect(mockDisconnect).toHaveBeenCalled();
    });

    test('should disconnect observer on destroy', async () => {
      setupStorePageDOM();

      const mockDisconnect = jest.fn();
      (global.MutationObserver as jest.Mock).mockImplementation(() => ({
        observe: jest.fn(),
        disconnect: mockDisconnect,
        takeRecords: jest.fn(() => [])
      }));

      const manager = new InjectionManager({ autoReinject: true });
      const data = createMockHLTBData();

      await manager.injectHLTBData(data);
      manager.destroy();

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Error Handling (4 tests)
  // ============================================================================

  describe('Error Handling', () => {
    test('should handle invalid HLTB data gracefully', async () => {
      setupStorePageDOM();

      const manager = new InjectionManager();
      const invalidData = null as any;

      const result = await manager.injectHLTBData(invalidData);

      // Should still attempt injection (display component handles validation)
      expect(result).toBe(true);
    });

    test('should handle missing injection point gracefully', async () => {
      setupEmptyPageDOM();

      const manager = new InjectionManager();
      const data = createMockHLTBData();

      const result = await manager.injectHLTBData(data);

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });

    test('should handle display creation failure', async () => {
      setupStorePageDOM();

      // Mock display creation to throw error
      (HLTBDisplay as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Display creation failed');
      });

      const manager = new InjectionManager();
      const data = createMockHLTBData();

      const result = await manager.injectHLTBData(data);

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });

    test('should handle mount failure gracefully', async () => {
      setupStorePageDOM();

      // Mock mount to throw error
      const mockMount = jest.fn(() => {
        throw new Error('Mount failed');
      });

      (HLTBDisplay as jest.Mock).mockImplementationOnce(() => ({
        mount: mockMount,
        setData: jest.fn(),
        setLoading: jest.fn(),
        setError: jest.fn(),
        destroy: jest.fn(),
        getMetrics: jest.fn(),
        getState: jest.fn()
      }));

      const manager = new InjectionManager();
      const data = createMockHLTBData();

      const result = await manager.injectHLTBData(data);

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Performance (3 tests)
  // ============================================================================

  describe('Performance', () => {
    test('should get component metrics', async () => {
      setupStorePageDOM();

      const manager = new InjectionManager();
      const data = createMockHLTBData();

      await manager.injectHLTBData(data);
      const metrics = manager.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics?.totalTime).toBeDefined();
    });

    test('should return null metrics when no display exists', () => {
      const manager = new InjectionManager();
      const metrics = manager.getMetrics();

      expect(metrics).toBeNull();
    });

    test('should inject component quickly', async () => {
      setupStorePageDOM();

      const manager = new InjectionManager();
      const data = createMockHLTBData();

      const start = performance.now();
      await manager.injectHLTBData(data);
      const end = performance.now();

      expect(end - start).toBeLessThan(100);
    });
  });
});
