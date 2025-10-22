/**
 * Core TypeScript interfaces for Steam page detection system
 */

/**
 * Comprehensive game information extracted from Steam pages
 */
export interface GameInfo {
  /** Steam App ID */
  appId: string;

  /** Normalized game title */
  title: string;

  /** Original raw title before normalization */
  rawTitle: string;

  /** Type of Steam page */
  pageType: PageType;

  /** Product type classification */
  productType: ProductType;

  /** URL where the game was detected */
  url: string;

  /** Confidence score of detection (0-1) */
  confidence: number;

  /** Additional metadata */
  metadata: GameMetadata;
}

/**
 * Steam page type classification
 */
export enum PageType {
  STORE = 'store',
  COMMUNITY = 'community',
  UNKNOWN = 'unknown'
}

/**
 * Product type classification
 */
export enum ProductType {
  GAME = 'game',
  DLC = 'dlc',
  DEMO = 'demo',
  BUNDLE = 'bundle',
  SOFTWARE = 'software',
  UNKNOWN = 'unknown'
}

/**
 * Additional game metadata
 */
export interface GameMetadata {
  /** Developer name */
  developer?: string;

  /** Publisher name */
  publisher?: string;

  /** Release date */
  releaseDate?: string;

  /** Steam tags */
  tags?: string[];

  /** Price information */
  price?: PriceInfo;

  /** Image URLs */
  images?: ImageInfo;

  /** Detection method used for title extraction */
  detectionMethod: TitleDetectionMethod;

  /** Timestamp of detection */
  detectedAt: number;
}

/**
 * Price information
 */
export interface PriceInfo {
  /** Current price in cents */
  current?: number;

  /** Original price in cents (before discount) */
  original?: number;

  /** Currency code */
  currency?: string;

  /** Discount percentage */
  discount?: number;

  /** Whether the game is free */
  isFree?: boolean;
}

/**
 * Image information
 */
export interface ImageInfo {
  /** Header image URL */
  header?: string;

  /** Capsule image URL */
  capsule?: string;

  /** Screenshot URLs */
  screenshots?: string[];
}

/**
 * Title detection methods in order of preference
 */
export enum TitleDetectionMethod {
  OPENGRAPH = 'opengraph',
  APP_NAME = 'app_name',
  JSON_LD = 'json_ld',
  BREADCRUMB = 'breadcrumb',
  PAGE_TITLE = 'page_title',
  FALLBACK = 'fallback'
}

/**
 * Detection configuration options
 */
export interface DetectionConfig {
  /** Maximum time to wait for async content (ms) */
  maxWaitTime?: number;

  /** Whether to use aggressive detection methods */
  aggressive?: boolean;

  /** Whether to cache detection results */
  useCache?: boolean;

  /** Custom selectors for detection */
  customSelectors?: CustomSelectors;
}

/**
 * Custom CSS selectors for detection
 */
export interface CustomSelectors {
  /** Title selectors */
  title?: string[];

  /** App ID selectors */
  appId?: string[];

  /** Price selectors */
  price?: string[];

  /** Developer selectors */
  developer?: string[];
}

/**
 * Navigation state information
 */
export interface NavigationState {
  /** Current URL */
  currentUrl: string;

  /** Previous URL */
  previousUrl: string;

  /** Whether this is the initial page load */
  isInitialLoad: boolean;

  /** Whether the page is still loading */
  isLoading: boolean;

  /** Timestamp of navigation */
  navigationTime: number;

  /** Navigation type */
  navigationType: NavigationType;
}

/**
 * Navigation type classification
 */
export enum NavigationType {
  INITIAL_LOAD = 'initial_load',
  SPA_NAVIGATION = 'spa_navigation',
  BACK_FORWARD = 'back_forward',
  RELOAD = 'reload',
  UNKNOWN = 'unknown'
}

/**
 * DOM observation configuration
 */
export interface ObservationConfig {
  /** Whether to observe child list changes */
  childList?: boolean;

  /** Whether to observe subtree changes */
  subtree?: boolean;

  /** Whether to observe attribute changes */
  attributes?: boolean;

  /** Specific attributes to observe */
  attributeFilter?: string[];

  /** Debounce delay for observations (ms) */
  debounceDelay?: number;
}

/**
 * Performance metrics for detection system
 */
export interface PerformanceMetrics {
  /** Detection start time */
  startTime: number;

  /** Detection end time */
  endTime: number;

  /** Total detection time (ms) */
  detectionTime: number;

  /** DOM queries performed */
  domQueries: number;

  /** Memory usage (bytes) */
  memoryUsage?: number;
}

/**
 * Error information for failed detections
 */
export interface DetectionError {
  /** Error message */
  message: string;

  /** Error code */
  code: DetectionErrorCode;

  /** Stack trace */
  stack?: string;

  /** Context information */
  context?: Record<string, any>;

  /** Timestamp of error */
  timestamp: number;
}

/**
 * Detection error codes
 */
export enum DetectionErrorCode {
  TIMEOUT = 'timeout',
  DOM_NOT_READY = 'dom_not_ready',
  NO_APP_ID = 'no_app_id',
  NO_TITLE = 'no_title',
  INVALID_URL = 'invalid_url',
  NETWORK_ERROR = 'network_error',
  PARSING_ERROR = 'parsing_error',
  NOT_GAME_PAGE = 'not_game_page',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * Result of a detection operation
 */
export interface DetectionResult {
  /** Whether detection was successful */
  success: boolean;

  /** Game information (if successful) */
  gameInfo?: GameInfo;

  /** Error information (if failed) */
  error?: DetectionError;

  /** Performance metrics */
  metrics: PerformanceMetrics;
}

// Export HLTB UI component types
export * from './HLTB';