/**
 * Comprehensive Steam page detection system with multiple extraction strategies
 */

import {
  GameInfo,
  SteamPageType,
  SteamPageSource,
  TitleExtractionMethod,
  DetectorConfig,
  DetectionResult,
  GameMetadata,
  PriceInfo
} from '../types/GameInfo';
import { DomUtils } from '../utils/DomUtils';

export class SteamPageDetector {
  private config: DetectorConfig;

  // Comprehensive URL patterns for different Steam page types
  private static readonly URL_PATTERNS = {
    [SteamPageType.GAME]: [
      /^https?:\/\/store\.steampowered\.com\/app\/(\d+)\/[^\/]*\/?$/,
      /^https?:\/\/steamcommunity\.com\/app\/(\d+)/,
      /^https?:\/\/steamcommunity\.com\/games\/[^\/]+\/(\d+)/
    ],
    [SteamPageType.DLC]: [
      /^https?:\/\/store\.steampowered\.com\/app\/(\d+)\/[^\/]*\/?.*dlc/i,
      /^https?:\/\/store\.steampowered\.com\/app\/(\d+)\/.*\?category=downloadable_content/
    ],
    [SteamPageType.BUNDLE]: [
      /^https?:\/\/store\.steampowered\.com\/bundle\/(\d+)/,
      /^https?:\/\/store\.steampowered\.com\/sub\/(\d+)/
    ],
    [SteamPageType.DEMO]: [
      /^https?:\/\/store\.steampowered\.com\/app\/(\d+)\/.*demo/i
    ],
    [SteamPageType.SOFTWARE]: [
      /^https?:\/\/store\.steampowered\.com\/app\/(\d+)\/.*\?category=software/
    ]
  };

  // Title extraction strategies in order of preference
  private static readonly TITLE_SELECTORS = {
    [TitleExtractionMethod.OG_TITLE]: 'meta[property="og:title"]',
    [TitleExtractionMethod.APP_NAME_ELEMENT]: '.apphub_AppName, #appHubAppName_Container .apphub_AppName',
    [TitleExtractionMethod.JSON_LD]: 'script[type="application/ld+json"]',
    [TitleExtractionMethod.BREADCRUMB]: '.breadcrumbs a:last-child, .game_page_background .blockbg .breadcrumbs a:last-child',
    [TitleExtractionMethod.PAGE_TITLE]: 'title',
    [TitleExtractionMethod.FALLBACK]: 'h1, .game_title, .app_title'
  };

  constructor(config: Partial<DetectorConfig> = {}) {
    this.config = {
      maxWaitTime: 5000,
      checkInterval: 200,
      debug: false,
      ...config
    };
  }

  /**
   * Main detection method - comprehensive page analysis
   */
  async detectPage(url: string = window.location.href): Promise<DetectionResult> {
    const startTime = performance.now();

    try {
      if (this.config.debug) {
        console.log('[SteamPageDetector] Starting detection for:', url);
      }

      // Check if URL should be excluded
      if (this.isExcludedUrl(url)) {
        return {
          success: false,
          error: 'URL matches exclusion pattern',
          detectionTime: performance.now() - startTime
        };
      }

      // Step 1: Determine page type and extract app ID
      const urlAnalysis = this.analyzeUrl(url);
      if (!urlAnalysis.appId) {
        return {
          success: false,
          error: 'Could not extract app ID from URL',
          detectionTime: performance.now() - startTime
        };
      }

      // Step 2: Wait for content to be ready
      const contentReady = await DomUtils.waitForContentStability(this.config);
      if (!contentReady && this.config.debug) {
        console.warn('[SteamPageDetector] Content may still be loading');
      }

      // Step 3: Extract title using multiple strategies
      const titleResult = await this.extractTitle();
      if (!titleResult.title) {
        return {
          success: false,
          error: 'Could not extract game title',
          detectionTime: performance.now() - startTime,
          contentLoading: DomUtils.isPageLoading()
        };
      }

      // Step 4: Extract additional metadata
      const metadata = this.extractMetadata(urlAnalysis.pageType);

      // Step 5: Construct GameInfo object
      const gameInfo: GameInfo = {
        appId: urlAnalysis.appId,
        title: titleResult.title,
        pageType: urlAnalysis.pageType,
        pageSource: urlAnalysis.pageSource,
        url: url,
        titleSource: titleResult.method,
        metadata,
        extractedAt: Date.now()
      };

      const detectionTime = performance.now() - startTime;

      if (this.config.debug) {
        console.log('[SteamPageDetector] Detection successful:', {
          gameInfo,
          detectionTime: `${detectionTime.toFixed(2)}ms`
        });
      }

      return {
        success: true,
        gameInfo,
        detectionTime,
        contentLoading: DomUtils.isPageLoading()
      };

    } catch (error) {
      console.error('[SteamPageDetector] Detection error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        detectionTime: performance.now() - startTime
      };
    }
  }

  /**
   * Analyze URL to determine page type and extract app ID
   */
  private analyzeUrl(url: string): {
    appId: string | null;
    pageType: SteamPageType;
    pageSource: SteamPageSource
  } {
    // Determine page source
    let pageSource: SteamPageSource;
    if (url.includes('store.steampowered.com')) {
      pageSource = SteamPageSource.STORE;
    } else if (url.includes('steamcommunity.com')) {
      pageSource = SteamPageSource.COMMUNITY;
    } else {
      pageSource = SteamPageSource.LIBRARY;
    }

    // Try to match against known patterns
    for (const [pageType, patterns] of Object.entries(SteamPageDetector.URL_PATTERNS)) {
      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          return {
            appId: match[1],
            pageType: pageType as SteamPageType,
            pageSource
          };
        }
      }
    }

    // Fallback: try to extract any app ID
    const appIdMatch = url.match(/\/app\/(\d+)/);
    if (appIdMatch) {
      return {
        appId: appIdMatch[1],
        pageType: SteamPageType.GAME, // Default assumption
        pageSource
      };
    }

    return {
      appId: null,
      pageType: SteamPageType.UNKNOWN,
      pageSource
    };
  }

  /**
   * Extract title using multiple strategies with fallbacks
   */
  private async extractTitle(): Promise<{ title: string; method: TitleExtractionMethod }> {
    // Strategy 1: OpenGraph title (most reliable)
    const ogTitle = this.extractOgTitle();
    if (ogTitle) {
      return { title: ogTitle, method: TitleExtractionMethod.OG_TITLE };
    }

    // Strategy 2: App name element (Steam-specific)
    const appNameTitle = this.extractAppNameElement();
    if (appNameTitle) {
      return { title: appNameTitle, method: TitleExtractionMethod.APP_NAME_ELEMENT };
    }

    // Strategy 3: JSON-LD structured data
    const jsonLdTitle = this.extractJsonLdTitle();
    if (jsonLdTitle) {
      return { title: jsonLdTitle, method: TitleExtractionMethod.JSON_LD };
    }

    // Strategy 4: Breadcrumb navigation
    const breadcrumbTitle = this.extractBreadcrumbTitle();
    if (breadcrumbTitle) {
      return { title: breadcrumbTitle, method: TitleExtractionMethod.BREADCRUMB };
    }

    // Strategy 5: Page title (with cleaning)
    const pageTitle = this.extractPageTitle();
    if (pageTitle) {
      return { title: pageTitle, method: TitleExtractionMethod.PAGE_TITLE };
    }

    // Strategy 6: Fallback selectors
    const fallbackTitle = this.extractFallbackTitle();
    if (fallbackTitle) {
      return { title: fallbackTitle, method: TitleExtractionMethod.FALLBACK };
    }

    return { title: '', method: TitleExtractionMethod.FALLBACK };
  }

  private extractOgTitle(): string {
    const element = document.querySelector('meta[property="og:title"]');
    return DomUtils.safeAttribute(element, 'content');
  }

  private extractAppNameElement(): string {
    const selectors = [
      '.apphub_AppName',
      '#appHubAppName_Container .apphub_AppName',
      '.apphub_AppName_Container .apphub_AppName'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && DomUtils.isElementVisible(element)) {
        const text = DomUtils.safeTextContent(element);
        if (text) return text;
      }
    }

    return '';
  }

  private extractJsonLdTitle(): string {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || '');
        if (data.name && typeof data.name === 'string') {
          return data.name;
        }
      } catch (error) {
        // Invalid JSON, continue to next script
      }
    }

    return '';
  }

  private extractBreadcrumbTitle(): string {
    const selectors = [
      '.breadcrumbs a:last-child',
      '.game_page_background .blockbg .breadcrumbs a:last-child'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const text = DomUtils.safeTextContent(element);
      if (text) return text;
    }

    return '';
  }

  private extractPageTitle(): string {
    const title = document.title;

    // Clean Steam-specific suffixes
    const cleanTitle = title
      .replace(/ on Steam$/, '')
      .replace(/ - Steam$/, '')
      .replace(/ \| Steam$/, '')
      .replace(/^Steam - /, '')
      .trim();

    return cleanTitle !== title ? cleanTitle : '';
  }

  private extractFallbackTitle(): string {
    const selectors = ['h1', '.game_title', '.app_title', '.game_area_title'];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && DomUtils.isElementVisible(element)) {
        const text = DomUtils.safeTextContent(element);
        if (text) return text;
      }
    }

    return '';
  }

  /**
   * Extract additional metadata based on page type
   */
  private extractMetadata(pageType: SteamPageType): GameMetadata {
    const metadata: GameMetadata = {};

    // Developer/Publisher
    const devPubInfo = this.extractDeveloperPublisher();
    if (devPubInfo.developer) metadata.developer = devPubInfo.developer;
    if (devPubInfo.publisher) metadata.publisher = devPubInfo.publisher;

    // Release date
    const releaseDate = this.extractReleaseDate();
    if (releaseDate) metadata.releaseDate = releaseDate;

    // Price information (for store pages)
    if (pageType === SteamPageType.GAME || pageType === SteamPageType.DLC) {
      const priceInfo = this.extractPriceInfo();
      if (priceInfo) metadata.price = priceInfo;
    }

    // Tags/genres
    const tags = this.extractTags();
    if (tags.length > 0) metadata.tags = tags;

    return metadata;
  }

  private extractDeveloperPublisher(): { developer?: string; publisher?: string } {
    const result: { developer?: string; publisher?: string } = {};

    // Try different selectors for developer/publisher
    const devSelectors = [
      '.glance_ctn_responsive_left .dev_row .summary.column:nth-child(2)',
      '.glance_ctn .summary.column a',
      '.details_block a[href*="developer"]'
    ];

    for (const selector of devSelectors) {
      const element = document.querySelector(selector);
      const text = DomUtils.safeTextContent(element);
      if (text) {
        result.developer = text;
        break;
      }
    }

    return result;
  }

  private extractReleaseDate(): string {
    const selectors = [
      '.release_date .date',
      '.game_area_release_date .date',
      '.glance_ctn .date'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const text = DomUtils.safeTextContent(element);
      if (text) return text;
    }

    return '';
  }

  private extractPriceInfo(): PriceInfo | undefined {
    // Try to find price elements
    const priceContainer = document.querySelector('.game_area_purchase_game .game_purchase_price');
    if (!priceContainer) return undefined;

    const priceInfo: PriceInfo = {};

    // Check for discount
    const discountElement = priceContainer.querySelector('.discount_pct');
    if (discountElement) {
      const discountText = DomUtils.safeTextContent(discountElement);
      const discountMatch = discountText.match(/-(\d+)%/);
      if (discountMatch) {
        priceInfo.onSale = true;
        priceInfo.discountPercent = parseInt(discountMatch[1], 10);
      }
    }

    // Get current price
    const currentPriceElement = priceContainer.querySelector('.discount_final_price, .game_purchase_price');
    if (currentPriceElement) {
      const priceText = DomUtils.safeTextContent(currentPriceElement);
      // This would need more sophisticated parsing for different currencies
      priceInfo.currency = 'USD'; // Default assumption
    }

    return Object.keys(priceInfo).length > 0 ? priceInfo : undefined;
  }

  private extractTags(): string[] {
    const tags: string[] = [];
    const tagElements = document.querySelectorAll('.glance_tags a, .game_area_tag');

    tagElements.forEach(element => {
      const tag = DomUtils.safeTextContent(element).trim();
      if (tag) {
        tags.push(tag);
      }
    });

    return tags;
  }

  /**
   * Check if URL should be excluded from detection
   */
  private isExcludedUrl(url: string): boolean {
    if (!this.config.excludePatterns) return false;

    return this.config.excludePatterns.some(pattern => pattern.test(url));
  }

  /**
   * Quick check if current page is a Steam game page
   */
  static isGamePage(url: string = window.location.href): boolean {
    const patterns = [
      /store\.steampowered\.com\/app\/\d+/,
      /steamcommunity\.com\/app\/\d+/
    ];

    return patterns.some(pattern => pattern.test(url));
  }

  /**
   * Extract app ID from URL (static utility)
   */
  static extractAppId(url: string = window.location.href): string | null {
    const match = url.match(/\/app\/(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DetectorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}