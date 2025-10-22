/**
 * HLTB Steam Extension - Content Script (TypeScript)
 *
 * This is the main content script that runs on Steam game pages.
 * It detects game information, fetches HLTB data, and injects the UI component.
 */

import { createInjectionManager, InjectionManager } from './managers/InjectionManager';
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
 * Main content script class
 */
class HLTBContentScript {
  private injectionManager: InjectionManager | null = null;
  private lastUrl: string;
  private mutationObserver: MutationObserver | null = null;
  private currentHLTBData: HLTBData | null = null;
  private currentGameInfo: GameInfo | null = null;
  private reinjectCheckInterval: number | null = null;

  constructor() {
    this.lastUrl = window.location.href;
    this.log('Content script loaded on:', this.lastUrl);
  }

  /**
   * Initialize the extension
   */
  async initialize(): Promise<void> {
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

      // Extract game info
      const gameInfo = this.extractGameInfo();
      if (!gameInfo) {
        console.warn('[HLTB] Could not extract game info');
        return;
      }

      this.log('Game detected:', gameInfo);

      // Wait for Steam's page to stabilize before injecting
      await this.waitForPageStability();

      // Create injection manager
      this.injectionManager = createInjectionManager({
        displayConfig: {
          enableAnimations: true,
          showLoading: true,
          showErrors: true,
          theme: { mode: 'auto' },
          accessibility: true,
          enableLink: true,
          showSource: true
        },
        autoReinject: false, // Disable InjectionManager's auto-reinject, we'll handle it
        debug: true // Enable debug logging to see injection points
      });

      // Fetch HLTB data
      const hltbResponse = await this.sendMessage({
        action: 'fetchHLTB',
        gameTitle: gameInfo.title,
        appId: gameInfo.appId
      });

      // Inject data or error
      if (hltbResponse.success && hltbResponse.data) {
        this.log('Data received:', hltbResponse.data);

        // Store data for re-injection
        this.currentHLTBData = hltbResponse.data;
        this.currentGameInfo = gameInfo;

        await this.injectionManager.injectHLTBData(
          hltbResponse.data,
          gameInfo.title
        );

        // Log performance metrics
        const metrics = this.injectionManager.getMetrics();
        if (metrics) {
          this.log('Performance metrics:', metrics);
        }

        // Set up periodic check for component removal and re-inject
        this.setupReinjectCheck();
      } else {
        console.error('[HLTB] Failed to fetch data:', hltbResponse.error || 'No data returned');
        this.injectionManager.showError(
          hltbResponse.error || 'Failed to load completion times'
        );
      }

    } catch (error) {
      console.error('[HLTB] Extension error:', error);
      if (this.injectionManager) {
        this.injectionManager.showError(
          error instanceof Error ? error.message : 'Unknown error occurred'
        );
      }
    }
  }

  /**
   * Wait for Steam's page to stabilize before injecting
   * Steam loads content dynamically, so we need to wait
   */
  private async waitForPageStability(): Promise<void> {
    this.log('Waiting for page stability...');

    // Wait for key elements to be present
    const maxAttempts = 20; // 20 attempts * 250ms = 5 seconds max
    let attempts = 0;

    while (attempts < maxAttempts) {
      // Check for key Steam page elements that indicate page is loaded
      const purchaseArea = document.querySelector('.game_area_purchase');
      const gameDetails = document.querySelector('.game_details');
      const pageContent = document.querySelector('.page_content');

      if (purchaseArea || gameDetails || pageContent) {
        // Found a stable element, wait a bit more for animations to settle
        await this.sleep(1000); // Wait 1 second for Steam's animations
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

    // Strategy 1: Extract from URL (most reliable)
    // URL format: /app/1145350/Hades_II/
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

    // Validate we got a title
    if (!gameTitle) {
      return null;
    }

    return {
      appId,
      title: gameTitle
    };
  }

  /**
   * Clean title extracted from URL
   */
  private cleanUrlTitle(title: string): string {
    return title
      .replace(/_/g, ' ')          // Replace underscores with spaces
      .replace(/%20/g, ' ')         // Replace URL encoded spaces
      .trim();
  }

  /**
   * Clean title extracted from meta tags or document title
   */
  private cleanMetaTitle(title: string): string {
    return title
      .replace(/ on Steam$/, '')        // Remove " on Steam" suffix
      .replace(/^Save \d+% on /, '')    // Remove "Save X% on " prefix
      .trim();
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
   * Set up periodic check to ensure component stays injected
   */
  private setupReinjectCheck(): void {
    // Clear any existing interval
    if (this.reinjectCheckInterval !== null) {
      window.clearInterval(this.reinjectCheckInterval);
    }

    let consecutiveReinjects = 0;
    const MAX_REINJECT_ATTEMPTS = 3;

    // Check every 3 seconds if component is still in DOM
    this.reinjectCheckInterval = window.setInterval(async () => {
      const displayHost = document.querySelector('.hltb-display-host');

      if (!displayHost && this.currentHLTBData && this.injectionManager) {
        consecutiveReinjects++;

        if (consecutiveReinjects > MAX_REINJECT_ATTEMPTS) {
          this.log(`Stopping re-injection after ${MAX_REINJECT_ATTEMPTS} attempts - Steam may be removing it intentionally`);
          if (this.reinjectCheckInterval !== null) {
            window.clearInterval(this.reinjectCheckInterval);
            this.reinjectCheckInterval = null;
          }
          return;
        }

        this.log(`Component removed, re-injecting... (attempt ${consecutiveReinjects}/${MAX_REINJECT_ATTEMPTS})`);

        // Wait for page to stabilize again before re-injecting
        await this.waitForPageStability();

        // Re-inject the component with stored data
        try {
          await this.injectionManager.injectHLTBData(
            this.currentHLTBData,
            this.currentGameInfo?.title || 'Unknown'
          );
        } catch (error) {
          console.error('[HLTB] Re-injection failed:', error);
        }
      } else if (displayHost) {
        // Component is present, reset counter
        consecutiveReinjects = 0;
      }
    }, 3000); // Check every 3 seconds

    this.log('Re-inject check set up');
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
        if (this.injectionManager) {
          this.injectionManager.cleanup();
        }

        // Clear reinject check
        if (this.reinjectCheckInterval !== null) {
          window.clearInterval(this.reinjectCheckInterval);
          this.reinjectCheckInterval = null;
        }

        // Clear stored data
        this.currentHLTBData = null;
        this.currentGameInfo = null;

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
   * Clean up resources
   */
  destroy(): void {
    if (this.injectionManager) {
      this.injectionManager.destroy();
      this.injectionManager = null;
    }

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    if (this.reinjectCheckInterval !== null) {
      window.clearInterval(this.reinjectCheckInterval);
      this.reinjectCheckInterval = null;
    }

    this.currentHLTBData = null;
    this.currentGameInfo = null;

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
const contentScript = new HLTBContentScript();

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
export { HLTBContentScript };
export default contentScript;
