/**
 * NavigationObserver for handling SPA navigation detection and lifecycle management
 */

import { NavigationState, ObservationConfig } from '../types';
import { StateManager } from './StateManager';
import { debounce, throttle } from '../utils/dom';

export class NavigationObserver {
  private stateManager: StateManager;
  private observers: Set<MutationObserver> = new Set();
  private listeners: Set<(state: NavigationState) => void> = new Set();
  private config: Required<ObservationConfig>;
  private isActive = false;
  private unsubscribeStateManager?: () => void;
  private lastProcessedUrl = '';
  private processingMutations = false;
  private mutationBuffer: MutationRecord[] = [];
  private readonly MAX_MUTATION_BUFFER = 100;
  private performanceMonitor?: number;

  constructor(
    stateManager: StateManager,
    config: ObservationConfig = {}
  ) {
    this.stateManager = stateManager;
    this.config = {
      childList: true,
      subtree: true,
      attributes: false,
      attributeFilter: [],
      debounceDelay: 100,
      ...config
    };
  }

  /**
   * Start observing navigation changes
   */
  public start(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.setupStateManagerListener();
    this.setupDOMObservers();
    this.setupPerformanceMonitoring();

    console.log('[HLTB] NavigationObserver started');
  }

  /**
   * Stop observing navigation changes
   */
  public stop(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.cleanup();

    console.log('[HLTB] NavigationObserver stopped');
  }

  /**
   * Add navigation change listener
   */
  public addListener(listener: (state: NavigationState) => void): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Remove all listeners
   */
  public removeAllListeners(): void {
    this.listeners.clear();
  }

  /**
   * Check if observer is currently active
   */
  public isObserving(): boolean {
    return this.isActive;
  }

  /**
   * Get current state from state manager
   */
  public getCurrentState(): NavigationState {
    return this.stateManager.getCurrentState();
  }

  /**
   * Manually trigger state check (useful for testing)
   */
  public forceStateCheck(): void {
    const state = this.stateManager.getCurrentState();
    this.notifyListeners(state);
  }

  /**
   * Update observation configuration
   */
  public updateConfig(newConfig: Partial<ObservationConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };

    if (this.isActive) {
      // Restart observers with new config
      this.cleanup();
      this.setupDOMObservers();
    }
  }

  /**
   * Get observation statistics
   */
  public getStats(): ObservationStats {
    return {
      isActive: this.isActive,
      observerCount: this.observers.size,
      listenerCount: this.listeners.size,
      currentUrl: this.stateManager.getCurrentState().currentUrl,
      isGamePage: this.stateManager.isGamePage(),
      appId: this.stateManager.getCurrentAppId()
    };
  }

  private setupStateManagerListener(): void {
    this.unsubscribeStateManager = this.stateManager.addListener((state) => {
      this.handleStateChange(state);
    });
  }

  private setupDOMObservers(): void {
    // Main document observer for content changes
    this.setupMainDocumentObserver();

    // Head observer for meta tag changes
    this.setupHeadObserver();

    // Title observer for title changes
    this.setupTitleObserver();
  }

  private setupMainDocumentObserver(): void {
    const debouncedHandler = debounce(() => {
      if (this.isActive && !this.processingMutations) {
        this.processMutationBuffer();
      }
    }, this.config.debounceDelay);

    const observer = new MutationObserver((mutations) => {
      // Buffer mutations to process in batches
      this.mutationBuffer.push(...mutations);

      // Limit buffer size to prevent memory bloat
      if (this.mutationBuffer.length > this.MAX_MUTATION_BUFFER) {
        this.mutationBuffer = this.mutationBuffer.slice(-this.MAX_MUTATION_BUFFER);
      }

      debouncedHandler();
    });

    // Observe only specific containers to reduce mutation volume
    const containers = [
      document.querySelector('.page_content'),
      document.querySelector('.responsive_page_content'),
      document.querySelector('.game_page_background'),
      document.body
    ].filter(Boolean) as Element[];

    // Use the most specific container available
    const targetContainer = containers[0] || document.body;

    observer.observe(targetContainer, {
      childList: this.config.childList,
      subtree: false, // Observe only direct children for performance
      attributes: this.config.attributes,
      attributeFilter: this.config.attributeFilter
    });

    this.observers.add(observer);
  }

  private setupHeadObserver(): void {
    const throttledHandler = throttle(() => {
      if (this.isActive) {
        // Meta tag changes might affect game detection
        this.forceStateCheck();
      }
    }, 1000); // Throttle head changes to once per second

    const observer = new MutationObserver((mutations) => {
      // Only react to relevant meta tag changes
      const hasRelevantMetaChanges = mutations.some(mutation => {
        if (mutation.type === 'childList') {
          return Array.from(mutation.addedNodes).some(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              return element.tagName === 'META' &&
                     (element.getAttribute('property') === 'og:title' ||
                      element.getAttribute('name') === 'twitter:title');
            }
            return false;
          });
        }

        if (mutation.type === 'attributes' && mutation.target.nodeName === 'META') {
          const element = mutation.target as Element;
          return element.getAttribute('property') === 'og:title' ||
                 element.getAttribute('name') === 'twitter:title';
        }

        return false;
      });

      if (hasRelevantMetaChanges) {
        throttledHandler();
      }
    });

    observer.observe(document.head, {
      childList: true,
      subtree: false, // Only direct children of head
      attributes: true,
      attributeFilter: ['content', 'property', 'name']
    });

    this.observers.add(observer);
  }

  private setupTitleObserver(): void {
    const throttledHandler = throttle(() => {
      if (this.isActive) {
        this.forceStateCheck();
      }
    }, 500); // Throttle title changes

    const observer = new MutationObserver(throttledHandler);

    const titleElement = document.querySelector('title');
    if (titleElement) {
      observer.observe(titleElement, {
        childList: true,
        characterData: true
      });

      this.observers.add(observer);
    }
  }

  private setupPerformanceMonitoring(): void {
    // Throttled performance monitoring
    const performanceCheck = throttle(() => {
      this.checkPerformance();
    }, 10000); // Check every 10 seconds (less frequent)

    // Monitor observer count and memory usage
    this.performanceMonitor = window.setInterval(performanceCheck, 10000);
  }

  private handleStateChange(state: NavigationState): void {
    try {
      this.notifyListeners(state);
    } catch (error) {
      console.error('[HLTB] Error handling state change:', error);
    }
  }

  private notifyListeners(state: NavigationState): void {
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('[HLTB] Error in navigation listener:', error);
      }
    });
  }

  private isRelevantMutation(mutation: MutationRecord): boolean {
    // Optimized relevance check with early exits
    if (mutation.type === 'childList') {
      // Quick check for Steam game page indicators
      for (const node of Array.from(mutation.addedNodes)) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          const className = element.className;
          const id = element.id;

          // Fast class/ID based checks (faster than querySelector)
          if (className.includes('game_area_purchase') ||
              className.includes('apphub_AppName') ||
              className.includes('breadcrumbs') ||
              id.includes('game') ||
              element.hasAttribute('data-appid')) {
            return true;
          }

          // Only do expensive querySelector if element looks promising
          if (className.includes('game') || className.includes('app')) {
            const hasRelevantChild = element.querySelector('[data-appid], .apphub_AppName, .game_area_purchase');
            if (hasRelevantChild) {
              return true;
            }
          }
        }
      }
    }

    if (mutation.type === 'attributes') {
      const attributeName = mutation.attributeName;
      // Only care about specific attribute changes
      return attributeName === 'data-appid' ||
             attributeName === 'content' ||
             attributeName === 'property';
    }

    return false;
  }

  private checkPerformance(): void {
    const stats = this.getStats();

    // Log performance warnings if needed
    if (stats.observerCount > 10) {
      console.warn(`[HLTB] High observer count: ${stats.observerCount}`);
    }

    if (stats.listenerCount > 20) {
      console.warn(`[HLTB] High listener count: ${stats.listenerCount}`);
    }

    // Check memory usage if available
    const memory = (performance as any).memory;
    if (memory && memory.usedJSHeapSize > 50 * 1024 * 1024) { // 50MB
      console.warn('[HLTB] High memory usage detected');
    }
  }

  private cleanup(): void {
    // Disconnect all observers
    this.observers.forEach(observer => {
      observer.disconnect();
    });
    this.observers.clear();

    // Clear performance monitor
    if (this.performanceMonitor) {
      clearInterval(this.performanceMonitor);
      this.performanceMonitor = undefined;
    }

    // Clear mutation buffer
    this.mutationBuffer = [];
    this.processingMutations = false;

    // Unsubscribe from state manager
    if (this.unsubscribeStateManager) {
      this.unsubscribeStateManager();
      this.unsubscribeStateManager = undefined;
    }
  }

  /**
   * Process buffered mutations in batch
   */
  private processMutationBuffer(): void {
    if (this.processingMutations || this.mutationBuffer.length === 0) {
      return;
    }

    this.processingMutations = true;

    try {
      // Check if any buffered mutations are relevant
      const hasRelevantChanges = this.mutationBuffer.some(mutation =>
        this.isRelevantMutation(mutation)
      );

      if (hasRelevantChanges) {
        // Check if URL changed (for SPA navigation detection)
        const currentUrl = window.location.href;
        if (currentUrl !== this.lastProcessedUrl) {
          this.lastProcessedUrl = currentUrl;
          this.forceStateCheck();
        } else {
          // Only process if we're on a game page
          if (currentUrl.includes('/app/')) {
            this.forceStateCheck();
          }
        }
      }

      // Clear processed mutations
      this.mutationBuffer = [];
    } finally {
      this.processingMutations = false;
    }
  }

  /**
   * Pause observation temporarily (useful during heavy DOM manipulation)
   */
  public pause(): void {
    this.observers.forEach(observer => observer.disconnect());
  }

  /**
   * Resume observation after pause
   */
  public resume(): void {
    if (this.isActive) {
      this.cleanup();
      this.setupDOMObservers();
    }
  }

  /**
   * Get memory usage statistics
   */
  public getMemoryStats(): {
    observerCount: number;
    mutationBufferSize: number;
    listenerCount: number;
  } {
    return {
      observerCount: this.observers.size,
      mutationBufferSize: this.mutationBuffer.length,
      listenerCount: this.listeners.size
    };
  }
}

/**
 * Statistics about the observation system
 */
export interface ObservationStats {
  isActive: boolean;
  observerCount: number;
  listenerCount: number;
  currentUrl: string;
  isGamePage: boolean;
  appId: string | null;
}