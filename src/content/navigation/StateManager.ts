/**
 * StateManager for tracking navigation state and managing SPA transitions
 */

import { NavigationState, NavigationType } from '../types';
import { debounce } from '../utils/dom';

export class StateManager {
  private currentState: NavigationState;
  private listeners: Set<(state: NavigationState) => void> = new Set();
  private initialized = false;

  constructor() {
    this.currentState = this.createInitialState();
    this.setupEventListeners();
  }

  /**
   * Initialize the state manager
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    // Wait for initial DOM to be ready
    await this.waitForInitialLoad();

    this.initialized = true;
    this.notifyListeners();
  }

  /**
   * Get current navigation state
   */
  public getCurrentState(): NavigationState {
    return { ...this.currentState };
  }

  /**
   * Add a state change listener
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
   * Manually trigger state update (for testing or forced updates)
   */
  public updateState(updates: Partial<NavigationState>): void {
    this.currentState = {
      ...this.currentState,
      ...updates
    };
    this.notifyListeners();
  }

  /**
   * Check if current page is a Steam game page
   */
  public isGamePage(): boolean {
    const url = this.currentState.currentUrl;
    return this.isGamePageUrl(url);
  }

  /**
   * Check if navigation is to a different game page
   */
  public isGamePageNavigation(): boolean {
    const currentIsGame = this.isGamePageUrl(this.currentState.currentUrl);
    const previousIsGame = this.isGamePageUrl(this.currentState.previousUrl);

    return currentIsGame && (
      !previousIsGame ||
      this.extractAppId(this.currentState.currentUrl) !== this.extractAppId(this.currentState.previousUrl)
    );
  }

  /**
   * Get current app ID if on game page
   */
  public getCurrentAppId(): string | null {
    if (!this.isGamePage()) return null;
    return this.extractAppId(this.currentState.currentUrl);
  }

  /**
   * Destroy the state manager
   */
  public destroy(): void {
    this.removeAllListeners();
    this.initialized = false;
  }

  private createInitialState(): NavigationState {
    return {
      currentUrl: window.location.href,
      previousUrl: '',
      isInitialLoad: true,
      isLoading: document.readyState !== 'complete',
      navigationTime: Date.now(),
      navigationType: NavigationType.INITIAL_LOAD
    };
  }

  private setupEventListeners(): void {
    // Monitor URL changes for SPA navigation
    this.setupUrlChangeMonitoring();

    // Monitor loading state changes
    this.setupLoadingStateMonitoring();

    // Monitor browser navigation
    this.setupBrowserNavigationMonitoring();
  }

  private setupUrlChangeMonitoring(): void {
    let lastUrl = window.location.href;

    // Debounced URL change handler
    const handleUrlChange = debounce(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        this.handleNavigation(currentUrl, lastUrl);
        lastUrl = currentUrl;
      }
    }, 100);

    // Use MutationObserver to detect URL changes in SPAs
    const observer = new MutationObserver(handleUrlChange);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also listen for popstate events
    window.addEventListener('popstate', handleUrlChange);

    // Periodically check URL (fallback)
    setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        handleUrlChange();
      }
    }, 1000);
  }

  private setupLoadingStateMonitoring(): void {
    const updateLoadingState = () => {
      const isLoading = document.readyState !== 'complete';
      if (isLoading !== this.currentState.isLoading) {
        this.currentState = {
          ...this.currentState,
          isLoading
        };
        this.notifyListeners();
      }
    };

    document.addEventListener('readystatechange', updateLoadingState);
    window.addEventListener('load', updateLoadingState);
  }

  private setupBrowserNavigationMonitoring(): void {
    window.addEventListener('beforeunload', () => {
      this.currentState = {
        ...this.currentState,
        isLoading: true
      };
    });

    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        // Page was restored from cache
        this.handleNavigation(
          window.location.href,
          this.currentState.currentUrl,
          NavigationType.BACK_FORWARD
        );
      }
    });
  }

  private handleNavigation(
    newUrl: string,
    oldUrl: string,
    navigationType?: NavigationType
  ): void {
    const detectedNavigationType = navigationType || this.detectNavigationType(newUrl, oldUrl);

    this.currentState = {
      currentUrl: newUrl,
      previousUrl: oldUrl,
      isInitialLoad: false,
      isLoading: document.readyState !== 'complete',
      navigationTime: Date.now(),
      navigationType: detectedNavigationType
    };

    this.notifyListeners();
  }

  private detectNavigationType(newUrl: string, oldUrl: string): NavigationType {
    // If URLs are the same, likely a reload
    if (newUrl === oldUrl) {
      return NavigationType.RELOAD;
    }

    // Check if it's browser back/forward navigation
    // This is a heuristic - perfect detection is difficult
    const timeSinceLastNavigation = Date.now() - this.currentState.navigationTime;
    if (timeSinceLastNavigation < 100) {
      return NavigationType.BACK_FORWARD;
    }

    // Default to SPA navigation
    return NavigationType.SPA_NAVIGATION;
  }

  private async waitForInitialLoad(): Promise<void> {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        resolve();
        return;
      }

      const handleLoad = () => {
        window.removeEventListener('load', handleLoad);
        resolve();
      };

      window.addEventListener('load', handleLoad);

      // Fallback timeout
      setTimeout(resolve, 5000);
    });
  }

  private notifyListeners(): void {
    const state = this.getCurrentState();
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('[HLTB] Error in state listener:', error);
      }
    });
  }

  private isGamePageUrl(url: string): boolean {
    return (
      url.includes('store.steampowered.com/app/') ||
      url.includes('steamcommunity.com/app/')
    );
  }

  private extractAppId(url: string): string | null {
    const match = url.match(/\/app\/(\d+)/);
    return match ? match[1] : null;
  }
}