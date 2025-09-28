/**
 * State management for clean navigation transitions and extension state
 */

import {
  GameInfo,
  NavigationState,
  DetectionResult,
  ExtensionState,
  DetectionState,
  UIState,
  PerformanceMetrics
} from '../types/GameInfo';

export type StateChangeHandler = (newState: ExtensionState, previousState: ExtensionState) => void;

export class StateManager {
  private state: ExtensionState;
  private handlers: Set<StateChangeHandler> = new Set();
  private stateHistory: ExtensionState[] = [];
  private maxHistorySize = 10;

  constructor(initialState?: Partial<ExtensionState>) {
    this.state = {
      enabled: true,
      navigation: {
        currentUrl: window.location.href,
        navigating: false,
        lastNavigationTime: Date.now()
      },
      detection: {
        inProgress: false,
        failureCount: 0
      },
      ui: {
        displayed: false,
        injecting: false,
        theme: 'auto'
      },
      metrics: {
        totalDetections: 0,
        successfulDetections: 0,
        averageDetectionTime: 0,
        memoryUsage: 0,
        lastCheckTime: Date.now()
      },
      ...initialState
    };

    this.saveToHistory(this.state);
  }

  /**
   * Get current state (immutable copy)
   */
  getState(): ExtensionState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Update state with partial changes
   */
  updateState(changes: Partial<ExtensionState>): void {
    const previousState = this.getState();

    this.state = {
      ...this.state,
      ...changes
    };

    this.saveToHistory(this.state);
    this.notifyHandlers(this.state, previousState);
  }

  /**
   * Update navigation state
   */
  updateNavigation(navigationChanges: Partial<NavigationState>): void {
    const currentNavigation = this.state.navigation;

    this.updateState({
      navigation: {
        ...currentNavigation,
        ...navigationChanges
      }
    });
  }

  /**
   * Update detection state
   */
  updateDetection(detectionChanges: Partial<DetectionState>): void {
    const currentDetection = this.state.detection;

    this.updateState({
      detection: {
        ...currentDetection,
        ...detectionChanges
      }
    });
  }

  /**
   * Update UI state
   */
  updateUI(uiChanges: Partial<UIState>): void {
    const currentUI = this.state.ui;

    this.updateState({
      ui: {
        ...currentUI,
        ...uiChanges
      }
    });
  }

  /**
   * Update performance metrics
   */
  updateMetrics(metricsChanges: Partial<PerformanceMetrics>): void {
    const currentMetrics = this.state.metrics;

    this.updateState({
      metrics: {
        ...currentMetrics,
        ...metricsChanges,
        lastCheckTime: Date.now()
      }
    });
  }

  /**
   * Set current game with state transitions
   */
  setCurrentGame(gameInfo: GameInfo | undefined): void {
    const previousGame = this.state.currentGame;

    this.updateState({
      currentGame: gameInfo,
      previousGame: previousGame
    });

    // Update navigation state if game changed
    if (gameInfo && (!previousGame || previousGame.appId !== gameInfo.appId)) {
      this.updateNavigation({
        currentGameInfo: gameInfo
      });
    }
  }

  /**
   * Handle successful detection
   */
  onDetectionSuccess(result: DetectionResult): void {
    this.updateDetection({
      inProgress: false,
      lastResult: result,
      failureCount: 0,
      lastSuccessTime: Date.now()
    });

    // Update metrics
    const currentMetrics = this.state.metrics;
    const newTotal = currentMetrics.totalDetections + 1;
    const newSuccessful = currentMetrics.successfulDetections + 1;
    const newAverage = (
      (currentMetrics.averageDetectionTime * currentMetrics.totalDetections) +
      result.detectionTime
    ) / newTotal;

    this.updateMetrics({
      totalDetections: newTotal,
      successfulDetections: newSuccessful,
      averageDetectionTime: newAverage
    });

    if (result.gameInfo) {
      this.setCurrentGame(result.gameInfo);
    }
  }

  /**
   * Handle detection failure
   */
  onDetectionFailure(result: DetectionResult): void {
    const currentDetection = this.state.detection;

    this.updateDetection({
      inProgress: false,
      lastResult: result,
      failureCount: currentDetection.failureCount + 1
    });

    // Update metrics
    const currentMetrics = this.state.metrics;
    this.updateMetrics({
      totalDetections: currentMetrics.totalDetections + 1
    });

    // Schedule retry if failure count is reasonable
    if (currentDetection.failureCount < 3) {
      this.scheduleRetry();
    }
  }

  /**
   * Start detection process
   */
  startDetection(): void {
    // Clear any existing retry timeout
    if (this.state.detection.retryTimeoutId) {
      clearTimeout(this.state.detection.retryTimeoutId);
    }

    this.updateDetection({
      inProgress: true,
      retryTimeoutId: undefined
    });
  }

  /**
   * Handle navigation change
   */
  onNavigationChange(navigationState: NavigationState): void {
    this.updateNavigation(navigationState);

    // Reset detection state on navigation
    this.updateDetection({
      inProgress: false,
      failureCount: 0,
      lastResult: undefined
    });

    // Reset UI state on navigation
    this.updateUI({
      displayed: false,
      containerElement: undefined,
      injecting: false,
      lastError: undefined
    });

    // Clear current game if URL changed significantly
    if (this.hasSignificantUrlChange(navigationState)) {
      this.setCurrentGame(undefined);
    }
  }

  /**
   * Handle UI injection success
   */
  onUIInjected(containerElement: HTMLElement): void {
    this.updateUI({
      displayed: true,
      containerElement,
      injecting: false,
      lastError: undefined
    });
  }

  /**
   * Handle UI injection failure
   */
  onUIInjectionFailure(error: string): void {
    this.updateUI({
      displayed: false,
      containerElement: undefined,
      injecting: false,
      lastError: error
    });
  }

  /**
   * Clean up UI state
   */
  cleanupUI(): void {
    const { containerElement } = this.state.ui;

    if (containerElement && containerElement.parentNode) {
      containerElement.parentNode.removeChild(containerElement);
    }

    this.updateUI({
      displayed: false,
      containerElement: undefined,
      injecting: false
    });
  }

  /**
   * Enable/disable extension
   */
  setEnabled(enabled: boolean): void {
    this.updateState({ enabled });

    if (!enabled) {
      this.cleanupUI();
    }
  }

  /**
   * Add state change handler
   */
  addHandler(handler: StateChangeHandler): void {
    this.handlers.add(handler);
  }

  /**
   * Remove state change handler
   */
  removeHandler(handler: StateChangeHandler): void {
    this.handlers.delete(handler);
  }

  /**
   * Get state history
   */
  getHistory(): ExtensionState[] {
    return [...this.stateHistory];
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    successRate: number;
    averageDetectionTime: number;
    totalAttempts: number;
    memoryUsage: number;
  } {
    const { metrics } = this.state;

    return {
      successRate: metrics.totalDetections > 0
        ? (metrics.successfulDetections / metrics.totalDetections) * 100
        : 0,
      averageDetectionTime: metrics.averageDetectionTime,
      totalAttempts: metrics.totalDetections,
      memoryUsage: metrics.memoryUsage
    };
  }

  /**
   * Reset all state to initial values
   */
  reset(): void {
    this.cleanupUI();

    const currentUrl = window.location.href;
    this.state = {
      enabled: true,
      navigation: {
        currentUrl,
        navigating: false,
        lastNavigationTime: Date.now()
      },
      detection: {
        inProgress: false,
        failureCount: 0
      },
      ui: {
        displayed: false,
        injecting: false,
        theme: 'auto'
      },
      metrics: {
        totalDetections: 0,
        successfulDetections: 0,
        averageDetectionTime: 0,
        memoryUsage: 0,
        lastCheckTime: Date.now()
      }
    };

    this.stateHistory = [this.getState()];
  }

  private scheduleRetry(): void {
    const retryTimeoutId = setTimeout(() => {
      this.startDetection();
    }, 1000 * Math.pow(2, this.state.detection.failureCount)) as unknown as number; // Exponential backoff

    this.updateDetection({ retryTimeoutId });
  }

  private hasSignificantUrlChange(navigationState: NavigationState): boolean {
    const { currentUrl, previousUrl } = navigationState;

    if (!previousUrl) return true;

    // Extract app IDs from URLs
    const currentAppId = currentUrl.match(/\/app\/(\d+)/)?.[1];
    const previousAppId = previousUrl.match(/\/app\/(\d+)/)?.[1];

    return currentAppId !== previousAppId;
  }

  private saveToHistory(state: ExtensionState): void {
    this.stateHistory.push(JSON.parse(JSON.stringify(state)));

    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }
  }

  private notifyHandlers(newState: ExtensionState, previousState: ExtensionState): void {
    this.handlers.forEach(handler => {
      try {
        handler(newState, previousState);
      } catch (error) {
        console.error('[StateManager] Handler error:', error);
      }
    });
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.cleanupUI();

    if (this.state.detection.retryTimeoutId) {
      clearTimeout(this.state.detection.retryTimeoutId);
    }

    this.handlers.clear();
    this.stateHistory = [];
  }
}

/**
 * Singleton state manager for global use
 */
export class GlobalStateManager {
  private static instance: StateManager | null = null;

  static getInstance(initialState?: Partial<ExtensionState>): StateManager {
    if (!GlobalStateManager.instance) {
      GlobalStateManager.instance = new StateManager(initialState);
    }
    return GlobalStateManager.instance;
  }

  static destroyInstance(): void {
    if (GlobalStateManager.instance) {
      GlobalStateManager.instance.destroy();
      GlobalStateManager.instance = null;
    }
  }
}