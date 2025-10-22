/**
 * Integration Example - HLTBDisplay Component
 *
 * This file demonstrates how to integrate the HLTBDisplay component
 * into the Steam content script for production use.
 *
 * @module IntegrationExample
 */

import { HLTBDisplay, createHLTBDisplay } from './HLTBDisplay';
import type { HLTBData, ComponentCallbacks } from './HLTBDisplay';

/**
 * Example 1: Basic Integration
 * Simplest way to use the component
 */
export function basicIntegration() {
  // Create component instance
  const display = createHLTBDisplay({
    enableAnimations: true,
    showLoading: true,
    theme: { mode: 'dark' }
  });

  // Find injection point on Steam page
  const targetElement = document.querySelector('.game_area_purchase');

  if (targetElement) {
    // Mount component before the purchase area
    display.mount(targetElement, 'before');

    // Show loading state while fetching data
    display.setLoading();

    // Fetch HLTB data from background service
    chrome.runtime.sendMessage(
      { action: 'fetchHLTB', gameTitle: 'Portal 2', appId: '620' },
      (response) => {
        if (response.success && response.data) {
          display.setData(response.data);
        } else {
          display.setError('Failed to load completion times');
        }
      }
    );
  }
}

/**
 * Example 2: Production Integration with Error Handling
 * Full implementation with proper error handling and cleanup
 */
export class HLTBContentScript {
  private display: HLTBDisplay | null = null;
  private currentUrl: string = '';

  constructor() {
    this.initialize();
    this.setupNavigationObserver();
  }

  /**
   * Initialize the extension on page load
   */
  private async initialize(): Promise<void> {
    if (!this.isGamePage()) {
      return;
    }

    try {
      // Check if extension is enabled
      const settings = await this.getSettings();

      if (!settings.enabled) {
        console.log('[HLTB] Extension disabled');
        return;
      }

      // Extract game information
      const gameInfo = this.extractGameInfo();

      if (!gameInfo) {
        console.warn('[HLTB] Could not extract game info');
        return;
      }

      // Create and mount component
      await this.createAndMountDisplay(gameInfo);

    } catch (error) {
      console.error('[HLTB] Initialization error:', error);
    }
  }

  /**
   * Creates and mounts the HLTBDisplay component
   */
  private async createAndMountDisplay(gameInfo: { title: string; appId: string }): Promise<void> {
    // Find injection point
    const injectionPoint = this.findInjectionPoint();

    if (!injectionPoint) {
      console.warn('[HLTB] No injection point found');
      return;
    }

    // Setup lifecycle callbacks
    const callbacks: ComponentCallbacks = {
      onCreate: () => {
        console.log('[HLTB] Component created');
      },

      onInject: () => {
        console.log('[HLTB] Component injected successfully');
      },

      onUpdate: (data: HLTBData) => {
        console.log('[HLTB] Data displayed:', {
          gameId: data.gameId,
          source: data.source,
          confidence: data.confidence
        });

        // Track analytics (optional)
        this.trackAnalytics('hltb_data_displayed', data);
      },

      onError: (error: Error) => {
        console.error('[HLTB] Component error:', error);
      },

      onDestroy: () => {
        console.log('[HLTB] Component destroyed');
      }
    };

    // Create display component
    this.display = new HLTBDisplay(
      {
        enableAnimations: true,
        showLoading: true,
        showErrors: true,
        theme: {
          mode: this.detectSteamTheme(),
          colors: {
            primary: '#66c0f4',  // Steam blue
            secondary: '#8b98a5',
            background: '#2a475e',
            text: '#c7d5e0',
            border: '#000000'
          }
        },
        accessibility: true,
        enableLink: true,
        showSource: true
      },
      callbacks
    );

    // Mount to Steam page
    this.display.mount(injectionPoint, 'before');

    // Show loading state
    this.display.setLoading();

    // Fetch HLTB data
    await this.fetchAndDisplayData(gameInfo);
  }

  /**
   * Fetches HLTB data and updates the display
   */
  private async fetchAndDisplayData(gameInfo: { title: string; appId: string }): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'fetchHLTB',
        gameTitle: gameInfo.title,
        appId: gameInfo.appId
      });

      if (response.success && response.data) {
        this.display?.setData(response.data);

        // Log performance metrics
        const metrics = this.display?.getMetrics();
        if (metrics) {
          console.log('[HLTB] Performance:', {
            creation: `${metrics.creationTime.toFixed(2)}ms`,
            injection: `${metrics.injectionTime.toFixed(2)}ms`,
            render: `${metrics.renderTime.toFixed(2)}ms`,
            total: `${metrics.totalTime.toFixed(2)}ms`,
            domOps: metrics.domOperations
          });
        }
      } else {
        this.display?.setError(response.error || 'Failed to load completion times');
      }
    } catch (error) {
      console.error('[HLTB] Fetch error:', error);
      this.display?.setError('Could not connect to background service');
    }
  }

  /**
   * Setup navigation observer for Steam's SPA
   */
  private setupNavigationObserver(): void {
    this.currentUrl = window.location.href;

    const observer = new MutationObserver(() => {
      if (window.location.href !== this.currentUrl) {
        this.currentUrl = window.location.href;
        console.log('[HLTB] Navigation detected');

        // Cleanup old component
        this.cleanup();

        // Re-initialize if still on game page
        if (this.isGamePage()) {
          this.initialize();
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Cleanup component on navigation
   */
  private cleanup(): void {
    if (this.display) {
      this.display.destroy();
      this.display = null;
    }
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
   * Extract game information from page
   */
  private extractGameInfo(): { title: string; appId: string } | null {
    // Extract app ID from URL
    const appIdMatch = window.location.href.match(/\/app\/(\d+)/);
    if (!appIdMatch) return null;

    let gameTitle = '';

    // Strategy 1: Extract from URL
    const urlTitleMatch = window.location.href.match(/\/app\/\d+\/([^\/\?#]+)/);
    if (urlTitleMatch) {
      gameTitle = urlTitleMatch[1]
        .replace(/_/g, ' ')
        .replace(/%20/g, ' ')
        .trim();
    }

    // Strategy 2: Community page app name
    if (!gameTitle) {
      const appNameElement = document.querySelector('#appHubAppName');
      if (appNameElement?.textContent) {
        gameTitle = appNameElement.textContent.trim();
      }
    }

    // Strategy 3: Meta tag
    if (!gameTitle) {
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle instanceof HTMLMetaElement && ogTitle.content) {
        gameTitle = ogTitle.content
          .replace(/ on Steam$/, '')
          .replace(/^Save \d+% on /, '')
          .trim();
      }
    }

    return gameTitle ? { title: gameTitle, appId: appIdMatch[1] } : null;
  }

  /**
   * Find injection point on Steam page
   */
  private findInjectionPoint(): Element | null {
    const selectors = [
      '.game_area_purchase',          // Store page - before purchase
      '.game_area_purchase_game',     // Store page - alternative
      '.apphub_AppName',              // Community page - after app name
      '.apphub_HomeHeader',           // Community page - header
      '.rightcol',                    // Store page - right column
      '.game_meta_data'               // Store page - meta area
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log('[HLTB] Injection point found:', selector);
        return element;
      }
    }

    return null;
  }

  /**
   * Detect Steam's current theme
   */
  private detectSteamTheme(): 'dark' | 'light' | 'auto' {
    // Check if Steam has light theme class
    if (document.body.classList.contains('light-theme')) {
      return 'light';
    }

    // Check system preference
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }

    // Default to dark (Steam's default)
    return 'dark';
  }

  /**
   * Get extension settings from storage
   */
  private async getSettings(): Promise<{ enabled: boolean }> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
        if (response.success && response.settings) {
          resolve(response.settings);
        } else {
          // Default to enabled if settings not found
          resolve({ enabled: true });
        }
      });
    });
  }

  /**
   * Track analytics (optional)
   */
  private trackAnalytics(event: string, data: HLTBData): void {
    // Example: Send to analytics service
    // This is optional and can be removed if not needed
    console.log('[HLTB] Analytics:', event, {
      gameId: data.gameId,
      source: data.source,
      confidence: data.confidence,
      hasMainStory: data.mainStory !== null,
      hasMainExtra: data.mainExtra !== null,
      hasCompletionist: data.completionist !== null
    });
  }
}

/**
 * Example 3: Advanced Usage with Dynamic Theme Switching
 */
export class AdvancedHLTBIntegration {
  private display: HLTBDisplay | null = null;

  async initialize() {
    this.display = createHLTBDisplay({
      theme: { mode: 'auto' },
      enableAnimations: true
    });

    // Mount component
    const target = document.querySelector('.game_area_purchase');
    if (target) {
      this.display.mount(target, 'before');
    }

    // Watch for Steam theme changes
    this.watchThemeChanges();

    // Watch for window resize (responsive design)
    this.watchResize();
  }

  /**
   * Watch for Steam theme changes
   */
  private watchThemeChanges(): void {
    const observer = new MutationObserver(() => {
      if (this.display) {
        const newTheme = this.detectTheme();
        this.display.setTheme({ mode: newTheme });
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    // Also watch system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (this.display) {
        this.display.setTheme({ mode: e.matches ? 'dark' : 'light' });
      }
    });
  }

  /**
   * Watch for window resize (optional performance optimization)
   */
  private watchResize(): void {
    let resizeTimeout: number;

    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);

      resizeTimeout = window.setTimeout(() => {
        // Re-render on resize complete (debounced)
        if (this.display) {
          const currentState = this.display.getState();
          console.log('[HLTB] Window resized, current state:', currentState);
        }
      }, 250);
    });
  }

  /**
   * Detect current theme
   */
  private detectTheme(): 'dark' | 'light' {
    if (document.body.classList.contains('light-theme')) {
      return 'light';
    }

    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }

    return 'dark';
  }
}

/**
 * Example 4: Testing Helper
 * Mock data for testing the component
 */
export function testHLTBDisplay(): void {
  const display = createHLTBDisplay({
    enableAnimations: false,  // Disable for faster testing
    theme: { mode: 'dark' }
  });

  const target = document.querySelector('.game_area_purchase');
  if (!target) {
    console.error('[HLTB] Test: No target element found');
    return;
  }

  display.mount(target, 'before');

  // Test loading state
  console.log('[HLTB] Test: Showing loading state');
  display.setLoading();

  setTimeout(() => {
    // Test success state
    console.log('[HLTB] Test: Showing success state');
    display.setData({
      mainStory: 12,
      mainExtra: 18,
      completionist: 25,
      allStyles: 15,
      gameId: '12345',
      source: 'api',
      confidence: 'high'
    });

    // Log metrics
    const metrics = display.getMetrics();
    console.log('[HLTB] Test: Performance metrics', metrics);
  }, 1000);

  setTimeout(() => {
    // Test error state
    console.log('[HLTB] Test: Showing error state');
    display.setError('This is a test error message');
  }, 3000);

  setTimeout(() => {
    // Test no data state
    console.log('[HLTB] Test: Showing no data state');
    display.setData({
      mainStory: null,
      mainExtra: null,
      completionist: null,
      source: 'fallback',
      confidence: 'low'
    });
  }, 5000);

  setTimeout(() => {
    // Cleanup
    console.log('[HLTB] Test: Destroying component');
    display.destroy();
  }, 7000);
}

/**
 * Example 5: Entry Point for Content Script
 * This is what you would use in your actual content.ts file
 */
export function initializeContentScript(): void {
  console.log('[HLTB] Content script initializing...');

  // Check if we're on a game page
  if (
    window.location.href.includes('store.steampowered.com/app/') ||
    window.location.href.includes('steamcommunity.com/app/')
  ) {
    // Initialize the integration
    const integration = new HLTBContentScript();

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      console.log('[HLTB] Page unloading, cleaning up...');
      // Integration handles cleanup automatically via navigation observer
    });

    console.log('[HLTB] Content script initialized successfully');
  } else {
    console.log('[HLTB] Not a game page, skipping initialization');
  }
}

// Auto-initialize when script loads (for production)
if (typeof window !== 'undefined') {
  initializeContentScript();
}
