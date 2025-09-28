/**
 * Enhanced content script with modular Steam page detection system
 * Integrates all detection components for robust performance
 */

import { SteamPageDetector } from './detection/SteamPageDetector';
import { NavigationObserver, GlobalNavigationObserver } from './navigation/NavigationObserver';
import { StateManager, GlobalStateManager } from './managers/StateManager';
import { DomUtils } from './utils/DomUtils';
import {
  GameInfo,
  NavigationState,
  DetectionResult,
  ExtensionState
} from './types/GameInfo';

export class ContentScript {
  private detector: SteamPageDetector;
  private navigationObserver: NavigationObserver;
  private stateManager: StateManager;
  private isInitialized = false;

  constructor() {
    // Initialize with performance-optimized configuration
    this.detector = new SteamPageDetector({
      maxWaitTime: 5000,
      checkInterval: 200,
      debug: process.env.NODE_ENV === 'development',
      excludePatterns: [
        /\/search\//,
        /\/browse\//,
        /\/stats\//,
        /\/news\//
      ]
    });

    this.navigationObserver = GlobalNavigationObserver.getInstance({
      debounce: true,
      debounceDelay: 150,
      maxMutationBatch: 50,
      targetSelectors: [
        '.page_content',
        '.responsive_page_content',
        '.game_page_background'
      ]
    });

    this.stateManager = GlobalStateManager.getInstance();

    this.setupEventHandlers();
  }

  /**
   * Initialize the content script
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('[ContentScript] Already initialized');
      return;
    }

    try {
      console.log('[ContentScript] Initializing on:', window.location.href);

      // Check if extension is enabled
      const extensionEnabled = await this.checkExtensionEnabled();
      if (!extensionEnabled) {
        console.log('[ContentScript] Extension is disabled');
        return;
      }

      this.stateManager.setEnabled(true);

      // Check if we're on a Steam page that should be processed
      if (!SteamPageDetector.isGamePage()) {
        console.log('[ContentScript] Not a Steam game page');
        return;
      }

      // Start navigation observer
      this.navigationObserver.start();

      // Perform initial detection with optimized timing
      // Use requestIdleCallback if available for better performance
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => this.performDetection(), { timeout: 2000 });
      } else {
        setTimeout(() => this.performDetection(), 100);
      }

      this.isInitialized = true;
      console.log('[ContentScript] Initialization complete');

    } catch (error) {
      console.error('[ContentScript] Initialization error:', error);
      this.handleError(error);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    console.log('[ContentScript] Destroying content script');

    this.navigationObserver.stop();
    this.stateManager.cleanupUI();
    this.stateManager.destroy();

    this.isInitialized = false;
  }

  /**
   * Force re-detection of current page
   */
  async refresh(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
      return;
    }

    await this.performDetection();
  }

  private setupEventHandlers(): void {
    // Handle navigation changes
    this.navigationObserver.addCallback(this.handleNavigation.bind(this));

    // Handle state changes
    this.stateManager.addHandler(this.handleStateChange.bind(this));

    // Handle extension messages
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    }

    // Handle page visibility changes
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

    // Handle errors
    window.addEventListener('error', this.handleError.bind(this));
  }

  private async handleNavigation(navigationState: NavigationState): Promise<void> {
    console.log('[ContentScript] Navigation detected:', navigationState.currentUrl);

    this.stateManager.onNavigationChange(navigationState);

    // Only process navigation if it's to a game page
    if (SteamPageDetector.isGamePage(navigationState.currentUrl)) {
      // Wait for content to stabilize after navigation
      await DomUtils.waitForContentStability({ maxWaitTime: 3000 });
      await this.performDetection();
    } else {
      // Clean up if navigating away from game pages
      this.stateManager.cleanupUI();
    }
  }

  private handleStateChange(newState: ExtensionState, previousState: ExtensionState): void {
    // Handle state transitions
    if (newState.currentGame && !previousState.currentGame) {
      // New game detected
      this.onGameDetected(newState.currentGame);
    }

    if (previousState.currentGame && !newState.currentGame) {
      // Game no longer detected
      this.onGameLost();
    }

    if (newState.enabled !== previousState.enabled) {
      // Extension enabled/disabled
      if (!newState.enabled) {
        this.stateManager.cleanupUI();
      }
    }
  }

  private async performDetection(): Promise<void> {
    try {
      this.stateManager.startDetection();

      console.log('[ContentScript] Starting page detection');
      const result = await this.detector.detectGame();

      if (result.success && result.gameInfo) {
        console.log('[ContentScript] Game detected:', result.gameInfo);
        this.stateManager.onDetectionSuccess(result);
        await this.requestGameData(result.gameInfo);
      } else {
        console.warn('[ContentScript] Detection failed:', result.error);
        this.stateManager.onDetectionFailure(result);
      }

    } catch (error) {
      console.error('[ContentScript] Detection error:', error);
      const failureResult: DetectionResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        detectionTime: 0
      };
      this.stateManager.onDetectionFailure(failureResult);
    }
  }

  private async onGameDetected(gameInfo: GameInfo): Promise<void> {
    console.log('[ContentScript] Game detected:', gameInfo.title);

    // Update navigation observer with game info
    this.navigationObserver.updateGameInfo(gameInfo);
  }

  private onGameLost(): void {
    console.log('[ContentScript] Game no longer detected');
    this.navigationObserver.updateGameInfo(undefined);
  }

  private async requestGameData(gameInfo: GameInfo): Promise<void> {
    try {
      console.log('[ContentScript] Requesting HLTB data for:', gameInfo.title);

      const response = await chrome.runtime.sendMessage({
        action: 'fetchHLTB',
        gameTitle: gameInfo.title,
        appId: gameInfo.appId,
        pageType: gameInfo.pageType
      });

      if (response.success) {
        console.log('[ContentScript] HLTB data received');
        await this.injectHLTBData(response.data, gameInfo);
      } else {
        console.error('[ContentScript] Failed to fetch HLTB data:', response.error);
      }

    } catch (error) {
      console.error('[ContentScript] Error requesting game data:', error);
    }
  }

  private async injectHLTBData(hltbData: any, gameInfo: GameInfo): Promise<void> {
    try {
      this.stateManager.updateUI({ injecting: true });

      // Clean up any existing UI
      this.stateManager.cleanupUI();

      // Create new UI container
      const container = this.createHLTBContainer(hltbData, gameInfo);

      // Find injection point based on page type
      const injectionPoint = this.findInjectionPoint(gameInfo);

      if (injectionPoint && container) {
        injectionPoint.parentNode?.insertBefore(container, injectionPoint);
        this.stateManager.onUIInjected(container);
        console.log('[ContentScript] HLTB UI injected successfully');
      } else {
        throw new Error('Could not find suitable injection point');
      }

    } catch (error) {
      console.error('[ContentScript] UI injection error:', error);
      this.stateManager.onUIInjectionFailure(
        error instanceof Error ? error.message : 'Unknown injection error'
      );
    }
  }

  private createHLTBContainer(hltbData: any, gameInfo: GameInfo): HTMLElement {
    const container = document.createElement('div');
    container.className = 'hltb-container hltb-enhanced';
    container.setAttribute('data-app-id', gameInfo.appId);
    container.setAttribute('data-page-type', gameInfo.pageType);

    // Create header
    const header = document.createElement('div');
    header.className = 'hltb-header';

    const logo = document.createElement('span');
    logo.className = 'hltb-logo';
    logo.textContent = 'HLTB';

    const title = document.createElement('span');
    title.className = 'hltb-title';
    title.textContent = 'HowLongToBeat';

    const gameTitle = document.createElement('span');
    gameTitle.className = 'hltb-game-title';
    gameTitle.textContent = gameInfo.title;

    header.appendChild(logo);
    header.appendChild(title);
    header.appendChild(gameTitle);

    // Create times container
    const timesContainer = document.createElement('div');
    timesContainer.className = 'hltb-times';

    // Create time boxes with enhanced data
    const timeBoxes = [
      { label: 'Main Story', value: this.sanitizeTime(hltbData.mainStory), key: 'main' },
      { label: 'Main + Extra', value: this.sanitizeTime(hltbData.mainExtra), key: 'extra' },
      { label: 'Completionist', value: this.sanitizeTime(hltbData.completionist), key: 'complete' }
    ];

    timeBoxes.forEach(({ label, value, key }) => {
      const timeBox = document.createElement('div');
      timeBox.className = `hltb-time-box hltb-time-${key}`;

      const labelEl = document.createElement('div');
      labelEl.className = 'hltb-label';
      labelEl.textContent = label;

      const hoursEl = document.createElement('div');
      hoursEl.className = 'hltb-hours';
      hoursEl.textContent = value || 'N/A';

      timeBox.appendChild(labelEl);
      timeBox.appendChild(hoursEl);
      timesContainer.appendChild(timeBox);
    });

    container.appendChild(header);
    container.appendChild(timesContainer);

    return container;
  }

  private findInjectionPoint(gameInfo: GameInfo): Element | null {
    // Different injection strategies based on page type and source
    const selectors = [
      '.game_area_purchase',
      '.game_area_purchase_game',
      '.rightcol',
      '.game_meta_data',
      '.glance_ctn'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && DomUtils.isElementVisible(element)) {
        return element;
      }
    }

    return null;
  }

  private sanitizeTime(timeStr: string): string {
    if (!timeStr || typeof timeStr !== 'string') return 'N/A';

    // Basic sanitization
    return timeStr
      .replace(/[<>"'&]/g, '')
      .trim();
  }

  private async checkExtensionEnabled(): Promise<boolean> {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
      return response.success && response.settings.enabled;
    } catch (error) {
      console.error('[ContentScript] Error checking extension status:', error);
      return false;
    }
  }

  private handleMessage(
    request: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): boolean | void {
    switch (request.action) {
      case 'refresh':
        this.refresh().then(() => {
          sendResponse({ success: true });
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return true; // Will respond asynchronously

      case 'getState':
        sendResponse({
          success: true,
          state: this.stateManager.getState(),
          metrics: this.stateManager.getPerformanceSummary()
        });
        break;

      case 'setEnabled':
        this.stateManager.setEnabled(request.enabled);
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }

  private handleVisibilityChange(): void {
    if (document.visibilityState === 'visible' && this.isInitialized) {
      // Re-detect when page becomes visible (in case content changed)
      setTimeout(() => this.performDetection(), 500);
    }
  }

  private handleError(error: any): void {
    console.error('[ContentScript] Error:', error);

    // Report error to background script
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        action: 'reportError',
        error: {
          message: error.message || 'Unknown error',
          stack: error.stack,
          url: window.location.href,
          timestamp: Date.now()
        }
      }).catch(() => {
        // Ignore errors when reporting errors
      });
    }
  }
}

// Auto-initialize when script loads
let contentScript: ContentScript | null = null;

function initializeContentScript(): void {
  if (contentScript) {
    contentScript.destroy();
  }

  contentScript = new ContentScript();
  contentScript.initialize().catch(error => {
    console.error('[ContentScript] Failed to initialize:', error);
  });
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  initializeContentScript();
}

// Handle extension context invalidation
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onConnect.addListener(() => {
    // Extension context is valid
  });

  // Check if extension context is invalidated
  try {
    chrome.runtime.getURL('');
  } catch (error) {
    console.log('[ContentScript] Extension context invalidated, reloading...');
    window.location.reload();
  }
}

// Export for potential external use
if (typeof window !== 'undefined') {
  (window as any).HLTBContentScript = contentScript;
}