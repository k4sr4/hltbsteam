/**
 * SteamPageDetector - Robust Steam page detection with 6-strategy title extraction
 */

import {
  GameInfo,
  PageType,
  ProductType,
  TitleDetectionMethod,
  DetectionConfig,
  DetectionResult,
  DetectionError,
  DetectionErrorCode,
  PerformanceMetrics,
  GameMetadata,
  PriceInfo,
  ImageInfo
} from '../types';
import {
  waitForElement,
  waitForDOMReady,
  getElementText,
  getElementAttribute,
  getTextFromSelectors,
  getFirstElementBySelectors,
  normalizeTitle,
  sanitizeString,
  measurePerformance
} from '../utils/dom';
import { GlobalPerformanceMonitor, monitored, measureAsync } from '../utils/PerformanceMonitor';

export class SteamPageDetector {
  private config: Required<DetectionConfig>;
  private cache: Map<string, GameInfo> = new Map();
  private elementCache: Map<string, Element | null> = new Map();
  private lastCacheCleanup = 0;
  private readonly CACHE_CLEANUP_INTERVAL = 30000; // 30 seconds
  private readonly MAX_CACHE_SIZE = 50;

  // URL pattern matchers
  private static readonly URL_PATTERNS = {
    GAME: /\/app\/(\d+)(?:\/[^/]*)?(?:\?|$)/,
    DLC: /\/app\/(\d+).*dlc/i,
    DEMO: /\/app\/(\d+).*demo/i,
    BUNDLE: /\/bundle\/(\d+)/,
    SOFTWARE: /\/app\/(\d+).*software/i
  };

  // Title extraction selectors in order of preference
  private static readonly TITLE_SELECTORS = {
    [TitleDetectionMethod.OPENGRAPH]: [
      'meta[property="og:title"]',
      'meta[name="twitter:title"]'
    ],
    [TitleDetectionMethod.APP_NAME]: [
      '.apphub_AppName',
      '.game_area_purchase h1',
      '.game_description_snippet h1'
    ],
    [TitleDetectionMethod.JSON_LD]: [
      'script[type="application/ld+json"]'
    ],
    [TitleDetectionMethod.BREADCRUMB]: [
      '.breadcrumbs a[href*="/app/"]',
      '.breadcrumb-trail a[href*="/app/"]'
    ],
    [TitleDetectionMethod.PAGE_TITLE]: [
      'title'
    ]
  };

  // App ID extraction selectors
  private static readonly APP_ID_SELECTORS = [
    '[data-appid]',
    'link[rel="canonical"]',
    '.game_area_purchase_game',
    '.apphub_HeaderTop'
  ];

  constructor(config: DetectionConfig = {}) {
    this.config = {
      maxWaitTime: config.maxWaitTime || 5000,
      aggressive: config.aggressive || false,
      useCache: config.useCache !== false,
      customSelectors: config.customSelectors || {}
    };
  }

  /**
   * Fast pre-check to determine if this is a potential Steam game page
   */
  public static isGamePage(url: string = window.location.href): boolean {
    // Fast URL-based check without DOM queries
    if (!url.includes('steampowered.com') && !url.includes('steamcommunity.com')) {
      return false;
    }

    // Check for game page patterns
    return SteamPageDetector.URL_PATTERNS.GAME.test(url) ||
           SteamPageDetector.URL_PATTERNS.DLC.test(url) ||
           SteamPageDetector.URL_PATTERNS.DEMO.test(url) ||
           SteamPageDetector.URL_PATTERNS.BUNDLE.test(url);
  }

  /**
   * Detect game information from current page with performance optimizations
   */
  @monitored('SteamPageDetector.detectGame')
  public async detectGame(): Promise<DetectionResult> {
    const startTime = performance.now();
    let domQueries = 0;

    try {
      // Fast early exit for non-game pages
      if (!SteamPageDetector.isGamePage()) {
        return {
          success: false,
          error: this.createError(
            DetectionErrorCode.NOT_GAME_PAGE,
            'Not a Steam game page'
          ),
          metrics: {
            startTime,
            endTime: performance.now(),
            detectionTime: performance.now() - startTime,
            domQueries: 0
          }
        };
      }

      // Clean up caches periodically
      this.cleanupCachesIfNeeded();

      // Check cache first
      const cacheKey = window.location.href;
      if (this.config.useCache && this.cache.has(cacheKey)) {
        const cachedInfo = this.cache.get(cacheKey)!;
        return {
          success: true,
          gameInfo: cachedInfo,
          metrics: {
            startTime,
            endTime: performance.now(),
            detectionTime: performance.now() - startTime,
            domQueries: 0
          }
        };
      }

      // Wait for DOM to be ready
      const isDOMReady = await waitForDOMReady(this.config.maxWaitTime);
      if (!isDOMReady) {
        throw this.createError(
          DetectionErrorCode.DOM_NOT_READY,
          'DOM not ready within timeout'
        );
      }

      // Extract basic page information
      const url = window.location.href;
      const pageType = this.detectPageType(url);
      domQueries++;

      // Extract App ID with caching
      const { result: appId } = await measurePerformance(
        () => this.extractAppIdOptimized(url),
        this.config.aggressive ? 'App ID extraction' : undefined
      );
      domQueries += 1;

      if (!appId) {
        throw this.createError(
          DetectionErrorCode.NO_APP_ID,
          'Could not extract App ID from page'
        );
      }

      // Extract title using optimized strategy approach
      const { result: titleInfo } = await measurePerformance(
        () => this.extractTitleOptimized(),
        this.config.aggressive ? 'Title extraction' : undefined
      );
      domQueries += 1;

      if (!titleInfo.title) {
        throw this.createError(
          DetectionErrorCode.NO_TITLE,
          'Could not extract game title from page'
        );
      }

      // Extract additional metadata
      const metadata = await this.extractMetadata();
      domQueries += 3; // Approximate for metadata extraction

      // Determine product type
      const productType = this.detectProductType(url, titleInfo.title, metadata);

      // Calculate confidence score
      const confidence = this.calculateConfidence(titleInfo, appId, metadata);

      // Create game info object
      const gameInfo: GameInfo = {
        appId,
        title: titleInfo.title,
        rawTitle: titleInfo.rawTitle,
        pageType,
        productType,
        url,
        confidence,
        metadata: {
          ...metadata,
          detectionMethod: titleInfo.method,
          detectedAt: Date.now()
        }
      };

      // Cache the result with size management
      if (this.config.useCache) {
        this.setCacheWithLimit(cacheKey, gameInfo);
      }

      const endTime = performance.now();

      return {
        success: true,
        gameInfo,
        metrics: {
          startTime,
          endTime,
          detectionTime: endTime - startTime,
          domQueries
        }
      };

    } catch (error) {
      const endTime = performance.now();
      const detectionError = error instanceof Error
        ? this.createError(DetectionErrorCode.UNKNOWN_ERROR, error.message, error.stack)
        : error as DetectionError;

      return {
        success: false,
        error: detectionError,
        metrics: {
          startTime,
          endTime,
          detectionTime: endTime - startTime,
          domQueries
        }
      };
    }
  }

  /**
   * Clear detection cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<DetectionConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };
  }

  private detectPageType(url: string): PageType {
    if (url.includes('store.steampowered.com')) {
      return PageType.STORE;
    } else if (url.includes('steamcommunity.com')) {
      return PageType.COMMUNITY;
    }
    return PageType.UNKNOWN;
  }

  private async extractAppIdOptimized(url: string): Promise<string | null> {
    // Try URL pattern first (fastest)
    for (const pattern of Object.values(SteamPageDetector.URL_PATTERNS)) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    // Try cached elements first
    for (const selector of SteamPageDetector.APP_ID_SELECTORS) {
      const element = this.getCachedElement(selector);
      if (element) {
        // Try data-appid attribute
        const dataAppId = getElementAttribute(element, 'data-appid');
        if (dataAppId) {
          return dataAppId;
        }

        // Try href attribute (for canonical links)
        const href = getElementAttribute(element, 'href');
        if (href) {
          const match = href.match(/\/app\/(\d+)/);
          if (match) {
            return match[1];
          }
        }
      }
    }

    // Aggressive mode: wait for elements to appear
    if (this.config.aggressive) {
      const element = await waitForElement(
        SteamPageDetector.APP_ID_SELECTORS.join(', '),
        this.config.maxWaitTime
      );

      if (element) {
        // Cache the found element
        SteamPageDetector.APP_ID_SELECTORS.forEach(selector => {
          try {
            if (element.matches(selector)) {
              this.elementCache.set(selector, element);
            }
          } catch {
            // Invalid selector, ignore
          }
        });

        const dataAppId = getElementAttribute(element, 'data-appid');
        if (dataAppId) {
          return dataAppId;
        }
      }
    }

    return null;
  }

  private async extractTitleOptimized(): Promise<{
    title: string;
    rawTitle: string;
    method: TitleDetectionMethod;
  }> {
    // Try fast methods first (minimal DOM queries)
    const fastStrategies = [
      TitleDetectionMethod.OPENGRAPH,
      TitleDetectionMethod.PAGE_TITLE
    ];

    for (const method of fastStrategies) {
      try {
        const result = await this.extractTitleByMethod(method);
        if (result && result.length > 2) { // Quick validation
          return {
            title: normalizeTitle(result),
            rawTitle: result,
            method
          };
        }
      } catch (error) {
        // Continue to next method
      }
    }

    // Try DOM-based methods with caching
    const domStrategies = [
      TitleDetectionMethod.APP_NAME,
      TitleDetectionMethod.JSON_LD,
      TitleDetectionMethod.BREADCRUMB,
      TitleDetectionMethod.FALLBACK
    ];

    for (const method of domStrategies) {
      try {
        const result = await this.extractTitleByMethod(method);
        if (result && result.length > 2) {
          return {
            title: normalizeTitle(result),
            rawTitle: result,
            method
          };
        }
      } catch (error) {
        console.warn(`[HLTB] Title extraction failed for method ${method}:`, error);
      }
    }

    return {
      title: '',
      rawTitle: '',
      method: TitleDetectionMethod.FALLBACK
    };
  }

  private async extractTitleByMethod(method: TitleDetectionMethod): Promise<string | null> {
    switch (method) {
      case TitleDetectionMethod.OPENGRAPH:
        return this.extractOpenGraphTitle();

      case TitleDetectionMethod.APP_NAME:
        return this.extractAppNameTitle();

      case TitleDetectionMethod.JSON_LD:
        return this.extractJsonLdTitle();

      case TitleDetectionMethod.BREADCRUMB:
        return this.extractBreadcrumbTitle();

      case TitleDetectionMethod.PAGE_TITLE:
        return this.extractPageTitle();

      case TitleDetectionMethod.FALLBACK:
        return this.extractFallbackTitle();

      default:
        return null;
    }
  }

  private extractOpenGraphTitle(): string | null {
    const selectors = SteamPageDetector.TITLE_SELECTORS[TitleDetectionMethod.OPENGRAPH];
    for (const selector of selectors) {
      const element = this.getCachedElement(selector);
      if (element) {
        const content = getElementAttribute(element, 'content');
        if (content) {
          return content;
        }
      }
    }
    return null;
  }

  private async extractAppNameTitle(): Promise<string | null> {
    const selectors = SteamPageDetector.TITLE_SELECTORS[TitleDetectionMethod.APP_NAME];

    // Try cached elements first
    for (const selector of selectors) {
      const element = this.getCachedElement(selector);
      if (element) {
        const text = getElementText(element);
        if (text) {
          return text;
        }
      }
    }

    // Try existing elements and cache them
    let text = getTextFromSelectors(selectors);
    if (text) {
      // Cache the found element for future use
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && getElementText(element) === text) {
          this.elementCache.set(selector, element);
          break;
        }
      }
      return text;
    }

    // If aggressive mode, wait for elements
    if (this.config.aggressive) {
      const element = await waitForElement(selectors.join(', '), this.config.maxWaitTime);
      if (element) {
        // Cache the found element
        for (const selector of selectors) {
          try {
            if (element.matches(selector)) {
              this.elementCache.set(selector, element);
              break;
            }
          } catch {
            // Invalid selector, continue
          }
        }

        text = getElementText(element);
        if (text) {
          return text;
        }
      }
    }

    return null;
  }

  private extractJsonLdTitle(): string | null {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of Array.from(scripts)) {
      try {
        const jsonText = script.textContent || '';

        // Security: Check for prototype pollution patterns
        if (this.containsDangerousPatterns(jsonText)) {
          console.warn('[SteamPageDetector] Dangerous patterns detected in JSON-LD, skipping');
          continue;
        }

        const data = JSON.parse(jsonText);

        // Security: Validate against prototype pollution
        if (this.isPrototypePolluted(data)) {
          console.warn('[SteamPageDetector] Potential prototype pollution detected, skipping');
          continue;
        }

        if (data.name) {
          return sanitizeString(data.name);
        }
        if (data['@type'] === 'Product' && data.name) {
          return sanitizeString(data.name);
        }
      } catch (error) {
        // Invalid JSON, continue to next script
      }
    }
    return null;
  }

  /**
   * Security: Check for dangerous patterns that could lead to prototype pollution
   */
  private containsDangerousPatterns(jsonText: string): boolean {
    const dangerousPatterns = ['__proto__', 'constructor', 'prototype'];
    return dangerousPatterns.some(pattern => jsonText.includes(pattern));
  }

  /**
   * Security: Validate that the parsed data doesn't contain prototype pollution
   */
  private isPrototypePolluted(data: any): boolean {
    try {
      return (
        data.__proto__ !== undefined ||
        data.constructor !== Object ||
        data.prototype !== undefined ||
        Object.prototype.hasOwnProperty.call(data, '__proto__') ||
        Object.prototype.hasOwnProperty.call(data, 'constructor') ||
        Object.prototype.hasOwnProperty.call(data, 'prototype')
      );
    } catch (error) {
      // If we can't validate safely, assume it's polluted
      return true;
    }
  }

  private extractBreadcrumbTitle(): string | null {
    const selectors = SteamPageDetector.TITLE_SELECTORS[TitleDetectionMethod.BREADCRUMB];

    // Try cached elements first
    for (const selector of selectors) {
      const element = this.getCachedElement(selector);
      if (element) {
        const text = getElementText(element);
        if (text) {
          return text;
        }
      }
    }

    // Fallback to fresh query and cache result
    const text = getTextFromSelectors(selectors);
    if (text) {
      // Cache the found element
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && getElementText(element) === text) {
          this.elementCache.set(selector, element);
          break;
        }
      }
    }
    return text;
  }

  private extractPageTitle(): string | null {
    const title = document.title;
    if (title) {
      // Remove common Steam suffixes
      return title
        .replace(/ on Steam$/, '')
        .replace(/ - Steam$/, '')
        .trim();
    }
    return null;
  }

  private extractFallbackTitle(): string | null {
    // Last resort: try any reasonable selector
    const fallbackSelectors = [
      'h1',
      'h2',
      '.title',
      '.name',
      '.game-title'
    ];

    return getTextFromSelectors(fallbackSelectors);
  }

  private async extractMetadata(): Promise<Omit<GameMetadata, 'detectionMethod' | 'detectedAt'>> {
    const metadata: Omit<GameMetadata, 'detectionMethod' | 'detectedAt'> = {};

    // Extract developer/publisher
    try {
      const devElement = document.querySelector('.dev_row .summary.column a, .developer .summary a');
      if (devElement) {
        metadata.developer = getElementText(devElement);
      }

      const pubElement = document.querySelector('.publisher .summary a');
      if (pubElement) {
        metadata.publisher = getElementText(pubElement);
      }
    } catch (error) {
      console.warn('[HLTB] Error extracting developer/publisher:', error);
    }

    // Extract release date
    try {
      const releaseDateElement = document.querySelector('.release_date .date');
      if (releaseDateElement) {
        metadata.releaseDate = getElementText(releaseDateElement);
      }
    } catch (error) {
      console.warn('[HLTB] Error extracting release date:', error);
    }

    // Extract tags
    try {
      const tagElements = document.querySelectorAll('.popular_tags a, .game_tag');
      metadata.tags = Array.from(tagElements)
        .map(el => getElementText(el))
        .filter(tag => tag.length > 0)
        .slice(0, 10); // Limit to 10 tags
    } catch (error) {
      console.warn('[HLTB] Error extracting tags:', error);
    }

    // Extract price info
    try {
      metadata.price = this.extractPriceInfo();
    } catch (error) {
      console.warn('[HLTB] Error extracting price:', error);
    }

    // Extract images
    try {
      metadata.images = this.extractImageInfo();
    } catch (error) {
      console.warn('[HLTB] Error extracting images:', error);
    }

    return metadata;
  }

  private extractPriceInfo(): PriceInfo | undefined {
    const priceInfo: PriceInfo = {};

    // Check if free
    const freeElement = document.querySelector('.game_purchase_price:contains("Free")');
    if (freeElement) {
      priceInfo.isFree = true;
      priceInfo.current = 0;
      return priceInfo;
    }

    // Extract current price
    const currentPriceElement = document.querySelector('.game_purchase_price, .discount_final_price');
    if (currentPriceElement) {
      const priceText = getElementText(currentPriceElement);
      const priceMatch = priceText.match(/[\d.,]+/);
      if (priceMatch) {
        priceInfo.current = Math.round(parseFloat(priceMatch[0].replace(',', '.')) * 100);
      }
    }

    // Extract original price (if on sale)
    const originalPriceElement = document.querySelector('.discount_original_price');
    if (originalPriceElement) {
      const priceText = getElementText(originalPriceElement);
      const priceMatch = priceText.match(/[\d.,]+/);
      if (priceMatch) {
        priceInfo.original = Math.round(parseFloat(priceMatch[0].replace(',', '.')) * 100);
      }
    }

    // Calculate discount
    if (priceInfo.current && priceInfo.original && priceInfo.original > priceInfo.current) {
      priceInfo.discount = Math.round(((priceInfo.original - priceInfo.current) / priceInfo.original) * 100);
    }

    return Object.keys(priceInfo).length > 0 ? priceInfo : undefined;
  }

  private extractImageInfo(): ImageInfo | undefined {
    const images: ImageInfo = {};

    // Header image
    const headerImg = document.querySelector('.game_header_image_full');
    if (headerImg) {
      images.header = getElementAttribute(headerImg, 'src');
    }

    // Capsule image
    const capsuleImg = document.querySelector('.game_header_image_ctn img');
    if (capsuleImg) {
      images.capsule = getElementAttribute(capsuleImg, 'src');
    }

    // Screenshots
    const screenshotElements = document.querySelectorAll('.highlight_screenshot img, .screenshot img');
    if (screenshotElements.length > 0) {
      images.screenshots = Array.from(screenshotElements)
        .map(img => getElementAttribute(img, 'src'))
        .filter(src => src.length > 0)
        .slice(0, 5); // Limit to 5 screenshots
    }

    return Object.keys(images).length > 0 ? images : undefined;
  }

  private detectProductType(url: string, title: string, metadata: any): ProductType {
    // Check URL patterns
    if (SteamPageDetector.URL_PATTERNS.DLC.test(url) || title.toLowerCase().includes('dlc')) {
      return ProductType.DLC;
    }

    if (SteamPageDetector.URL_PATTERNS.DEMO.test(url) || title.toLowerCase().includes('demo')) {
      return ProductType.DEMO;
    }

    if (SteamPageDetector.URL_PATTERNS.BUNDLE.test(url)) {
      return ProductType.BUNDLE;
    }

    if (SteamPageDetector.URL_PATTERNS.SOFTWARE.test(url)) {
      return ProductType.SOFTWARE;
    }

    // Check tags for additional classification
    if (metadata.tags) {
      const lowerTags = metadata.tags.map((tag: string) => tag.toLowerCase());
      if (lowerTags.includes('software') || lowerTags.includes('application')) {
        return ProductType.SOFTWARE;
      }
    }

    return ProductType.GAME;
  }

  private calculateConfidence(
    titleInfo: { title: string; method: TitleDetectionMethod },
    appId: string | null,
    metadata: any
  ): number {
    let confidence = 0;

    // Base confidence from title detection method
    const methodScores = {
      [TitleDetectionMethod.OPENGRAPH]: 0.9,
      [TitleDetectionMethod.APP_NAME]: 0.8,
      [TitleDetectionMethod.JSON_LD]: 0.7,
      [TitleDetectionMethod.BREADCRUMB]: 0.6,
      [TitleDetectionMethod.PAGE_TITLE]: 0.5,
      [TitleDetectionMethod.FALLBACK]: 0.3
    };

    confidence += methodScores[titleInfo.method] || 0;

    // Bonus for having app ID
    if (appId) {
      confidence += 0.1;
    }

    // Bonus for having metadata
    if (metadata.developer) confidence += 0.05;
    if (metadata.releaseDate) confidence += 0.05;
    if (metadata.tags && metadata.tags.length > 0) confidence += 0.05;

    // Penalty for very short or suspicious titles
    if (titleInfo.title.length < 3) {
      confidence -= 0.3;
    }

    return Math.min(Math.max(confidence, 0), 1);
  }

  private createError(
    code: DetectionErrorCode,
    message: string,
    stack?: string,
    context?: Record<string, any>
  ): DetectionError {
    return {
      code,
      message,
      stack,
      context,
      timestamp: Date.now()
    };
  }

  /**
   * Get cached element or query and cache it
   */
  private getCachedElement(selector: string): Element | null {
    // Check cache first
    if (this.elementCache.has(selector)) {
      const cachedElement = this.elementCache.get(selector);
      // Verify element is still in DOM
      if (cachedElement && document.contains(cachedElement)) {
        return cachedElement;
      } else {
        // Remove stale cache entry
        this.elementCache.delete(selector);
      }
    }

    // Query and cache
    try {
      const element = document.querySelector(selector);
      this.elementCache.set(selector, element);
      return element;
    } catch (error) {
      // Invalid selector
      this.elementCache.set(selector, null);
      return null;
    }
  }

  /**
   * Cache with size limit to prevent memory bloat
   */
  private setCacheWithLimit(key: string, value: GameInfo): void {
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entry (simple FIFO)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  /**
   * Clean up caches periodically to prevent memory leaks
   */
  private cleanupCachesIfNeeded(): void {
    const now = Date.now();
    if (now - this.lastCacheCleanup > this.CACHE_CLEANUP_INTERVAL) {
      // Clean element cache - remove stale references
      const staleCacheKeys: string[] = [];
      this.elementCache.forEach((element, key) => {
        if (element && !document.contains(element)) {
          staleCacheKeys.push(key);
        }
      });
      staleCacheKeys.forEach(key => this.elementCache.delete(key));

      // Limit cache sizes
      if (this.elementCache.size > this.MAX_CACHE_SIZE) {
        const keysToDelete = Array.from(this.elementCache.keys()).slice(0, this.elementCache.size - this.MAX_CACHE_SIZE);
        keysToDelete.forEach(key => this.elementCache.delete(key));
      }

      this.lastCacheCleanup = now;
    }
  }

  /**
   * Clear all caches and reset detector state
   */
  public clearCache(): void {
    this.cache.clear();
    this.elementCache.clear();
    this.lastCacheCleanup = 0;
  }
}