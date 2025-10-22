/**
 * HLTB Steam Extension - Hybrid Content Script
 *
 * Uses simple DOM injection (like the old content.js) but with TypeScript
 * architecture for better code organization and type safety.
 */

import { HLTBData } from './types/HLTB';

/**
 * Game information extracted from Steam pages
 */
interface GameInfo {
  appId: string;
  title: string;
}

/**
 * Message response from background service
 */
interface MessageResponse {
  success: boolean;
  data?: HLTBData;
  error?: string;
  settings?: {
    enabled: boolean;
  };
}

/**
 * Performance metrics for tracking
 */
interface PerformanceMetrics {
  startTime: number;
  injectionTime: number;
  totalTime: number;
}

/**
 * Main content script class using simple DOM injection
 */
class HLTBContentScriptHybrid {
  private lastUrl: string;
  private mutationObserver: MutationObserver | null = null;
  private containerElement: HTMLElement | null = null;
  private metrics: PerformanceMetrics | null = null;

  constructor() {
    this.lastUrl = window.location.href;
    this.log('Content script loaded on:', this.lastUrl);
  }

  /**
   * Initialize the extension
   */
  async initialize(): Promise<void> {
    const startTime = performance.now();

    // Check if we're on a game page
    if (!this.isGamePage()) {
      this.log('Not a game page, skipping initialization');
      return;
    }

    try {
      // Check if extension is enabled
      const settingsResponse = await this.sendMessage({ action: 'getSettings' });

      if (!settingsResponse.success || !settingsResponse.settings?.enabled) {
        this.log('Extension is disabled');
        return;
      }

      // Wait for Steam's page to stabilize
      await this.waitForPageStability();

      // Extract game info
      const gameInfo = this.extractGameInfo();
      if (!gameInfo) {
        console.warn('[HLTB] Could not extract game info');
        return;
      }

      this.log('Game detected:', gameInfo);

      // Fetch HLTB data
      const hltbResponse = await this.sendMessage({
        action: 'fetchHLTB',
        gameTitle: gameInfo.title,
        appId: gameInfo.appId
      });

      // Inject UI with data or error
      if (hltbResponse.success && hltbResponse.data) {
        this.log('Data received:', hltbResponse.data);
        const injectionTime = performance.now();

        this.injectHLTBData(hltbResponse.data);

        const totalTime = performance.now();
        this.metrics = {
          startTime,
          injectionTime: injectionTime - startTime,
          totalTime: totalTime - startTime
        };

        this.log('Performance metrics:', this.metrics);
      } else {
        console.error('[HLTB] Failed to fetch data:', hltbResponse.error || 'No data returned');
        this.injectError(hltbResponse.error || 'Failed to load completion times');
      }

    } catch (error) {
      console.error('[HLTB] Extension error:', error);
      this.injectError(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * Wait for Steam's page to stabilize before injecting
   */
  private async waitForPageStability(): Promise<void> {
    this.log('Waiting for page stability...');

    const maxAttempts = 20;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const purchaseArea = document.querySelector('.game_area_purchase');
      const gameDetails = document.querySelector('.game_details');
      const pageContent = document.querySelector('.page_content');

      if (purchaseArea || gameDetails || pageContent) {
        await this.sleep(500); // Wait for animations to settle
        this.log('Page appears stable, ready to inject');
        return;
      }

      await this.sleep(250);
      attempts++;
    }

    this.log('Timed out waiting for page stability, injecting anyway');
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if current page is a Steam game page
   */
  private isGamePage(): boolean {
    const url = window.location.href;
    return (
      url.includes('store.steampowered.com/app/') ||
      url.includes('steamcommunity.com/app/')
    );
  }

  /**
   * Extract game information from the Steam page
   */
  private extractGameInfo(): GameInfo | null {
    const url = window.location.href;

    // Extract app ID from URL
    const appIdMatch = url.match(/\/app\/(\d+)/);
    if (!appIdMatch) {
      return null;
    }

    const appId = appIdMatch[1];
    let gameTitle = '';

    // Strategy 1: Extract from URL
    const urlTitleMatch = url.match(/\/app\/\d+\/([^\/\?#]+)/);
    if (urlTitleMatch) {
      gameTitle = this.cleanUrlTitle(urlTitleMatch[1]);
    }

    // Strategy 2: Try app name element (community pages)
    if (!gameTitle) {
      const appNameElement = document.querySelector('#appHubAppName');
      if (appNameElement?.textContent) {
        gameTitle = appNameElement.textContent.trim();
      }
    }

    // Strategy 3: Try OpenGraph title meta tag
    if (!gameTitle) {
      const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement;
      if (ogTitle?.content) {
        gameTitle = this.cleanMetaTitle(ogTitle.content);
      }
    }

    // Strategy 4: Fallback to document title
    if (!gameTitle) {
      gameTitle = this.cleanMetaTitle(document.title);
    }

    if (!gameTitle) {
      return null;
    }

    return { appId, title: gameTitle };
  }

  /**
   * Clean title extracted from URL
   */
  private cleanUrlTitle(title: string): string {
    return title
      .replace(/_/g, ' ')
      .replace(/%20/g, ' ')
      .trim();
  }

  /**
   * Clean title extracted from meta tags or document title
   */
  private cleanMetaTitle(title: string): string {
    return title
      .replace(/ on Steam$/, '')
      .replace(/^Save \d+% on /, '')
      .trim();
  }

  /**
   * Inject HLTB data into the page using simple DOM manipulation
   */
  private injectHLTBData(data: HLTBData): void {
    // Remove any existing container
    this.cleanup();

    // Helper to format hours
    const formatHours = (hours: number | null): string => {
      if (hours === null || hours === undefined || hours === 0) {
        return '--';
      }
      return hours + (hours === 1 ? ' Hour' : ' Hours');
    };

    // Create container element
    const container = document.createElement('div');
    container.className = 'hltb-container';
    this.containerElement = container;

    // Add data attributes
    if (data.source) {
      container.setAttribute('data-source', data.source);
    }
    if (data.confidence) {
      container.setAttribute('data-confidence', data.confidence);
    }

    // Create header
    const header = document.createElement('div');
    header.className = 'hltb-header';

    const logo = document.createElement('span');
    logo.className = 'hltb-logo';
    logo.textContent = 'HLTB';

    const title = document.createElement('span');
    title.className = 'hltb-title';
    title.textContent = 'HowLongToBeat';

    // Add source indicator if available
    if (data.source && data.source !== 'api') {
      const sourceIndicator = document.createElement('span');
      sourceIndicator.className = 'hltb-source';
      const sourceText =
        data.source === 'cache' ? 'cached' :
        data.source === 'scraper' ? 'scraped' :
        data.source === 'fallback' ? 'estimated' :
        data.source === 'database' ? 'database' : '';

      if (sourceText) {
        sourceIndicator.textContent = `(${sourceText})`;
        title.appendChild(document.createTextNode(' '));
        title.appendChild(sourceIndicator);
      }
    }

    header.appendChild(logo);
    header.appendChild(title);

    // Create times container
    const timesContainer = document.createElement('div');
    timesContainer.className = 'hltb-times';

    // Create time boxes
    const timeBoxes = [
      { label: 'Main Story', value: formatHours(data.mainStory) },
      { label: 'Main + Extra', value: formatHours(data.mainExtra) },
      { label: 'Completionist', value: formatHours(data.completionist) }
    ];

    // Check if this is a multiplayer-only game
    const isMultiplayerOnly =
      data.mainStory === null &&
      data.mainExtra === null &&
      data.completionist === null;

    if (isMultiplayerOnly) {
      const multiplayerBox = document.createElement('div');
      multiplayerBox.className = 'hltb-multiplayer-notice';
      multiplayerBox.textContent = 'Multiplayer Game - No completion times';
      timesContainer.appendChild(multiplayerBox);
    } else {
      timeBoxes.forEach(({ label, value }) => {
        const timeBox = document.createElement('div');
        timeBox.className = 'hltb-time-box';

        if (value === '--') {
          timeBox.classList.add('hltb-no-data');
        }

        const labelEl = document.createElement('div');
        labelEl.className = 'hltb-label';
        labelEl.textContent = label;

        const hoursEl = document.createElement('div');
        hoursEl.className = 'hltb-hours';
        hoursEl.textContent = value;

        timeBox.appendChild(labelEl);
        timeBox.appendChild(hoursEl);
        timesContainer.appendChild(timeBox);
      });
    }

    container.appendChild(header);
    container.appendChild(timesContainer);

    // Find injection point and inject
    this.injectIntoPage(container);
  }

  /**
   * Inject error message
   */
  private injectError(message: string): void {
    this.cleanup();

    const container = document.createElement('div');
    container.className = 'hltb-container hltb-error-container';
    this.containerElement = container;

    const header = document.createElement('div');
    header.className = 'hltb-header';

    const title = document.createElement('span');
    title.className = 'hltb-title';
    title.textContent = 'HowLongToBeat';

    header.appendChild(title);

    const errorDiv = document.createElement('div');
    errorDiv.className = 'hltb-error';
    errorDiv.textContent = message;

    container.appendChild(header);
    container.appendChild(errorDiv);

    this.injectIntoPage(container);
  }

  /**
   * Find injection point and inject container
   */
  private injectIntoPage(container: HTMLElement): void {
    // Try multiple selectors for Store and Community pages
    const injectionSelectors = [
      '.game_area_purchase',
      '.game_area_purchase_game',
      '.apphub_AppName',
      '.apphub_HomeHeader',
      '.rightcol',
      '.game_meta_data',
      '#appHubAppName'
    ];

    let injected = false;
    for (const selector of injectionSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        // For community pages, inject after; for store pages, before
        if (selector.includes('apphub') || selector.includes('appHub')) {
          element.parentNode?.insertBefore(container, element.nextSibling);
        } else {
          element.parentNode?.insertBefore(container, element);
        }

        this.log('UI injected successfully at:', selector);
        injected = true;
        break;
      }
    }

    if (!injected) {
      console.warn('[HLTB] Could not find injection point');
    }
  }

  /**
   * Send message to background service worker
   */
  private async sendMessage(message: any): Promise<MessageResponse> {
    try {
      const response = await chrome.runtime.sendMessage(message);
      return response || { success: false, error: 'No response from background service' };
    } catch (error) {
      console.error('[HLTB] Message error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to communicate with extension'
      };
    }
  }

  /**
   * Set up navigation observer for Steam's SPA
   */
  setupNavigationObserver(): void {
    this.mutationObserver = new MutationObserver(() => {
      const currentUrl = window.location.href;

      if (currentUrl !== this.lastUrl) {
        this.lastUrl = currentUrl;
        this.log('Navigation detected:', currentUrl);

        // Clean up previous injection
        this.cleanup();

        // Re-initialize if still on a game page
        if (this.isGamePage()) {
          this.log('Re-initializing on new game page');
          this.initialize();
        }
      }
    });

    // Observe the body for changes (Steam's SPA navigation)
    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.log('Navigation observer set up');
  }

  /**
   * Clean up injected elements
   */
  private cleanup(): void {
    if (this.containerElement && this.containerElement.parentNode) {
      this.containerElement.parentNode.removeChild(this.containerElement);
      this.containerElement = null;
    }
  }

  /**
   * Destroy the content script
   */
  destroy(): void {
    this.cleanup();

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    this.log('Content script destroyed');
  }

  /**
   * Debug logging helper
   */
  private log(message: string, data?: any): void {
    if (data !== undefined) {
      console.log(`[HLTB] ${message}`, data);
    } else {
      console.log(`[HLTB] ${message}`);
    }
  }
}

// Initialize the content script
const contentScript = new HLTBContentScriptHybrid();

// Start on initial page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    contentScript.initialize();
    contentScript.setupNavigationObserver();
  });
} else {
  // DOM is already loaded
  contentScript.initialize();
  contentScript.setupNavigationObserver();
}

// Clean up on page unload
window.addEventListener('unload', () => {
  contentScript.destroy();
});

// Export for testing
export { HLTBContentScriptHybrid };
export default contentScript;
