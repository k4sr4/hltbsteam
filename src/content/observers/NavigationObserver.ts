/**
 * Efficient SPA navigation observer for Steam with performance optimizations
 */

import {
  NavigationState,
  ObserverConfig,
  GameInfo
} from '../types/GameInfo';
import { DomUtils } from '../utils/DomUtils';

export type NavigationCallback = (state: NavigationState) => void | Promise<void>;

export class NavigationObserver {
  private observer: MutationObserver | null = null;
  private navigationState: NavigationState;
  private config: ObserverConfig;
  private callbacks: Set<NavigationCallback> = new Set();
  private isObserving = false;
  private lastMutationTime = 0;

  // Performance tracking
  private mutationCount = 0;
  private averageProcessingTime = 0;

  constructor(config: Partial<ObserverConfig> = {}) {
    this.config = {
      debounce: true,
      debounceDelay: 150,
      maxMutationBatch: 50,
      targetSelectors: [
        '#global_header',
        '.page_content',
        '.responsive_page_content',
        '.game_page_background'
      ],
      ...config
    };

    this.navigationState = {
      currentUrl: window.location.href,
      navigating: false,
      lastNavigationTime: Date.now()
    };

    this.setupInitialState();
  }

  /**
   * Start observing navigation changes
   */
  start(): void {
    if (this.isObserving) {
      console.warn('[NavigationObserver] Already observing');
      return;
    }

    this.setupObserver();
    this.setupPopstateListener();
    this.isObserving = true;

    console.log('[NavigationObserver] Started observing navigation');
  }

  /**
   * Stop observing navigation changes
   */
  stop(): void {
    if (!this.isObserving) return;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    window.removeEventListener('popstate', this.handlePopstate);
    this.isObserving = false;

    console.log('[NavigationObserver] Stopped observing navigation');
  }

  /**
   * Add navigation callback
   */
  addCallback(callback: NavigationCallback): void {
    this.callbacks.add(callback);
  }

  /**
   * Remove navigation callback
   */
  removeCallback(callback: NavigationCallback): void {
    this.callbacks.delete(callback);
  }

  /**
   * Get current navigation state
   */
  getState(): NavigationState {
    return { ...this.navigationState };
  }

  /**
   * Update current game info
   */
  updateGameInfo(gameInfo: GameInfo | undefined): void {
    this.navigationState.currentGameInfo = gameInfo;
  }

  /**
   * Force trigger navigation detection
   */
  async forceCheck(): Promise<void> {
    await this.checkForNavigation();
  }

  /**
   * Get performance metrics
   */
  getMetrics(): {
    mutationCount: number;
    averageProcessingTime: number;
    isObserving: boolean;
  } {
    return {
      mutationCount: this.mutationCount,
      averageProcessingTime: this.averageProcessingTime,
      isObserving: this.isObserving
    };
  }

  private setupInitialState(): void {
    // Set up event listeners for immediate navigation detection
    if (typeof window !== 'undefined') {
      // Handle back/forward navigation
      this.handlePopstate = this.handlePopstate.bind(this);

      // Handle pushState/replaceState (Steam's SPA navigation)
      this.wrapHistoryMethods();
    }
  }

  private setupObserver(): void {
    // Use optimized observer from DomUtils
    const observerCallback = this.config.debounce
      ? DomUtils.debounce(this.handleMutations.bind(this), this.config.debounceDelay)
      : this.handleMutations.bind(this);

    this.observer = DomUtils.createOptimizedObserver(observerCallback, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });

    // Start observing the document body or specific targets with options
    const observerOptions: MutationObserverInit = {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    };

    const targets = this.getObservationTargets();
    targets.forEach(target => {
      if (target && this.observer) {
        this.observer.observe(target, observerOptions);
      }
    });
  }

  private getObservationTargets(): Element[] {
    const targets: Element[] = [];

    if (this.config.targetSelectors) {
      for (const selector of this.config.targetSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          targets.push(element);
        }
      }
    }

    // Fallback to document.body if no specific targets found
    if (targets.length === 0 && document.body) {
      targets.push(document.body);
    }

    return targets;
  }

  private handleMutations = async (mutations: MutationRecord[]): Promise<void> => {
    const startTime = performance.now();
    this.mutationCount++;

    // Limit mutation processing for performance
    const relevantMutations = mutations.slice(0, this.config.maxMutationBatch);

    // Check if any mutations indicate navigation
    const hasNavigationMutation = relevantMutations.some(mutation =>
      this.isNavigationMutation(mutation)
    );

    if (hasNavigationMutation || this.hasUrlChanged()) {
      this.lastMutationTime = Date.now();
      await this.checkForNavigation();
    }

    // Update performance metrics
    const processingTime = performance.now() - startTime;
    this.averageProcessingTime = (this.averageProcessingTime + processingTime) / 2;
  };

  private isNavigationMutation(mutation: MutationRecord): boolean {
    // Check if mutation affects navigation-relevant elements
    const navigationClasses = [
      'page_content',
      'responsive_page_content',
      'game_page_background',
      'app_header',
      'apphub_background'
    ];

    const isRelevantNode = (node: Node): boolean => {
      if (node.nodeType !== Node.ELEMENT_NODE) return false;

      const element = node as Element;
      return navigationClasses.some(className =>
        element.classList?.contains(className) ||
        element.querySelector(`.${className}`) !== null
      );
    };

    // Check added nodes
    const addedNodes = Array.from(mutation.addedNodes);
    if (addedNodes.some(isRelevantNode)) return true;

    // Check if target is navigation-relevant
    if (mutation.target && isRelevantNode(mutation.target)) return true;

    return false;
  }

  private hasUrlChanged(): boolean {
    return window.location.href !== this.navigationState.currentUrl;
  }

  private async checkForNavigation(): Promise<void> {
    const currentUrl = window.location.href;
    const previousUrl = this.navigationState.currentUrl;

    if (currentUrl === previousUrl) return;

    // Update navigation state
    this.navigationState = {
      currentUrl,
      previousUrl,
      navigating: true,
      currentGameInfo: undefined, // Will be updated by detector
      lastNavigationTime: Date.now()
    };

    // Notify callbacks
    await this.notifyCallbacks();

    // Wait a bit for page to stabilize, then mark navigation complete
    setTimeout(() => {
      this.navigationState.navigating = false;
    }, 500);
  }

  private async notifyCallbacks(): Promise<void> {
    const promises = Array.from(this.callbacks).map(async (callback) => {
      try {
        await callback(this.navigationState);
      } catch (error) {
        console.error('[NavigationObserver] Callback error:', error);
      }
    });

    await Promise.allSettled(promises);
  }

  private setupPopstateListener(): void {
    window.addEventListener('popstate', this.handlePopstate);
  }

  private handlePopstate = async (): Promise<void> => {
    await this.checkForNavigation();
  };

  private wrapHistoryMethods(): void {
    // Wrap pushState and replaceState to detect programmatic navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      setTimeout(() => this.checkForNavigation(), 0);
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      setTimeout(() => this.checkForNavigation(), 0);
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stop();
    this.callbacks.clear();

    // Restore original history methods if wrapped
    // Note: In production, you might want to keep references to restore them
  }
}

/**
 * Singleton navigation observer for global use
 */
export class GlobalNavigationObserver {
  private static instance: NavigationObserver | null = null;

  static getInstance(config?: Partial<ObserverConfig>): NavigationObserver {
    if (!GlobalNavigationObserver.instance) {
      GlobalNavigationObserver.instance = new NavigationObserver(config);
    }
    return GlobalNavigationObserver.instance;
  }

  static destroyInstance(): void {
    if (GlobalNavigationObserver.instance) {
      GlobalNavigationObserver.instance.destroy();
      GlobalNavigationObserver.instance = null;
    }
  }
}