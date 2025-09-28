/**
 * Mock data for Steam pages - realistic HTML and DOM structures for testing
 */

export interface SteamPageMock {
  url: string;
  html: string;
  expectedAppId: string;
  expectedTitle: string;
  expectedRawTitle: string;
  pageType: 'store' | 'community';
  productType: 'game' | 'dlc' | 'demo' | 'bundle' | 'software';
  confidence: number;
}

/**
 * Regular Steam game page mock
 */
export const REGULAR_GAME_MOCK: SteamPageMock = {
  url: 'https://store.steampowered.com/app/730/CounterStrike_2/',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Counter-Strike 2 on Steam</title>
      <meta property="og:title" content="Counter-Strike 2">
      <meta name="twitter:title" content="Counter-Strike 2">
      <link rel="canonical" href="https://store.steampowered.com/app/730/CounterStrike_2/">
      <script type="application/ld+json">
        {
          "@type": "Product",
          "name": "Counter-Strike 2",
          "description": "For over two decades, Counter-Strike has offered an elite competitive experience..."
        }
      </script>
    </head>
    <body>
      <div class="game_area_purchase" data-appid="730">
        <h1 class="apphub_AppName">Counter-Strike 2</h1>
        <div class="game_area_purchase_game">
          <div class="game_purchase_price">Free To Play</div>
        </div>
        <div class="dev_row">
          <div class="summary column">
            <a href="/developer/valve">Valve</a>
          </div>
        </div>
        <div class="publisher">
          <div class="summary">
            <a href="/publisher/valve">Valve</a>
          </div>
        </div>
        <div class="release_date">
          <div class="date">21 Aug, 2012</div>
        </div>
        <div class="popular_tags">
          <a href="/tags/fps">FPS</a>
          <a href="/tags/multiplayer">Multiplayer</a>
          <a href="/tags/competitive">Competitive</a>
        </div>
        <img class="game_header_image_full" src="https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg">
      </div>
      <div class="breadcrumbs">
        <a href="/app/730">Counter-Strike 2</a>
      </div>
    </body>
    </html>
  `,
  expectedAppId: '730',
  expectedTitle: 'Counter-Strike 2',
  expectedRawTitle: 'Counter-Strike 2',
  pageType: 'store',
  productType: 'game',
  confidence: 0.9
};

/**
 * DLC page mock
 */
export const DLC_MOCK: SteamPageMock = {
  url: 'https://store.steampowered.com/app/1234567/GameTitle_DLC_Pack/',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Game Title - DLC Pack on Steam</title>
      <meta property="og:title" content="Game Title - DLC Pack">
      <link rel="canonical" href="https://store.steampowered.com/app/1234567/GameTitle_DLC_Pack/">
    </head>
    <body>
      <div class="game_area_purchase" data-appid="1234567">
        <h1 class="apphub_AppName">Game Title - DLC Pack</h1>
        <div class="game_purchase_price">$9.99</div>
        <div class="popular_tags">
          <a href="/tags/dlc">DLC</a>
          <a href="/tags/expansion">Expansion</a>
        </div>
      </div>
    </body>
    </html>
  `,
  expectedAppId: '1234567',
  expectedTitle: 'Game Title - DLC Pack',
  expectedRawTitle: 'Game Title - DLC Pack',
  pageType: 'store',
  productType: 'dlc',
  confidence: 0.8
};

/**
 * Demo page mock
 */
export const DEMO_MOCK: SteamPageMock = {
  url: 'https://store.steampowered.com/app/9876543/Amazing_Game_Demo/',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Amazing Game Demo on Steam</title>
      <meta property="og:title" content="Amazing Game Demo">
    </head>
    <body>
      <div class="game_area_purchase" data-appid="9876543">
        <h1 class="apphub_AppName">Amazing Game Demo</h1>
        <div class="game_purchase_price">Free</div>
        <div class="popular_tags">
          <a href="/tags/demo">Demo</a>
        </div>
      </div>
    </body>
    </html>
  `,
  expectedAppId: '9876543',
  expectedTitle: 'Amazing Game Demo',
  expectedRawTitle: 'Amazing Game Demo',
  pageType: 'store',
  productType: 'demo',
  confidence: 0.8
};

/**
 * Bundle page mock (should be excluded)
 */
export const BUNDLE_MOCK: SteamPageMock = {
  url: 'https://store.steampowered.com/bundle/12345/Game_Bundle/',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Game Bundle on Steam</title>
      <meta property="og:title" content="Game Bundle">
    </head>
    <body>
      <div class="game_area_purchase">
        <h1 class="apphub_AppName">Game Bundle</h1>
        <div class="game_purchase_price">$49.99</div>
      </div>
    </body>
    </html>
  `,
  expectedAppId: '12345',
  expectedTitle: 'Game Bundle',
  expectedRawTitle: 'Game Bundle',
  pageType: 'store',
  productType: 'bundle',
  confidence: 0.7
};

/**
 * Game on sale mock
 */
export const SALE_GAME_MOCK: SteamPageMock = {
  url: 'https://store.steampowered.com/app/567890/Discounted_Game/',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Discounted Game™ - 50% off on Steam</title>
      <meta property="og:title" content="Discounted Game™ - 50% off">
    </head>
    <body>
      <div class="game_area_purchase" data-appid="567890">
        <h1 class="apphub_AppName">Discounted Game™ (Sale)</h1>
        <div class="discount_final_price">$14.99</div>
        <div class="discount_original_price">$29.99</div>
      </div>
    </body>
    </html>
  `,
  expectedAppId: '567890',
  expectedTitle: 'Discounted Game',
  expectedRawTitle: 'Discounted Game™ - 50% off',
  pageType: 'store',
  productType: 'game',
  confidence: 0.9
};

/**
 * Community page mock
 */
export const COMMUNITY_MOCK: SteamPageMock = {
  url: 'https://steamcommunity.com/app/730/discussions/',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Steam Community :: Counter-Strike 2</title>
      <meta property="og:title" content="Counter-Strike 2 Community">
    </head>
    <body>
      <div class="apphub_HeaderTop" data-appid="730">
        <h1 class="apphub_AppName">Counter-Strike 2</h1>
      </div>
      <div class="breadcrumbs">
        <a href="/app/730">Counter-Strike 2</a>
      </div>
    </body>
    </html>
  `,
  expectedAppId: '730',
  expectedTitle: 'Counter-Strike 2',
  expectedRawTitle: 'Counter-Strike 2 Community',
  pageType: 'community',
  productType: 'game',
  confidence: 0.8
};

/**
 * Edge case: No OpenGraph, fallback to page title
 */
export const FALLBACK_TITLE_MOCK: SteamPageMock = {
  url: 'https://store.steampowered.com/app/111111/Fallback_Game/',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Fallback Game - Steam</title>
    </head>
    <body>
      <div data-appid="111111">
        <h2 class="title">Fallback Game</h2>
      </div>
    </body>
    </html>
  `,
  expectedAppId: '111111',
  expectedTitle: 'Fallback Game',
  expectedRawTitle: 'Fallback Game',
  pageType: 'store',
  productType: 'game',
  confidence: 0.5
};

/**
 * Edge case: Malformed data
 */
export const MALFORMED_MOCK: SteamPageMock = {
  url: 'https://store.steampowered.com/app/222222/Malformed_Page/',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <title></title>
    </head>
    <body>
      <div>
        <!-- No proper selectors or data -->
      </div>
    </body>
    </html>
  `,
  expectedAppId: '222222',
  expectedTitle: '',
  expectedRawTitle: '',
  pageType: 'store',
  productType: 'game',
  confidence: 0.1
};

/**
 * Non-game page (should not detect)
 */
export const NON_GAME_MOCK = {
  url: 'https://store.steampowered.com/about/',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <title>About Steam</title>
    </head>
    <body>
      <h1>About Steam</h1>
      <p>Steam is a digital distribution platform...</p>
    </body>
    </html>
  `
};

/**
 * Adult content warning page
 */
export const ADULT_CONTENT_MOCK: SteamPageMock = {
  url: 'https://store.steampowered.com/app/333333/Adult_Game/',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Adult Game on Steam</title>
      <meta property="og:title" content="Adult Game">
    </head>
    <body>
      <div class="age_gate">
        <h1>Please enter your birth date to continue:</h1>
      </div>
      <div class="game_area_purchase" data-appid="333333" style="display: none;">
        <h1 class="apphub_AppName">Adult Game</h1>
      </div>
    </body>
    </html>
  `,
  expectedAppId: '333333',
  expectedTitle: 'Adult Game',
  expectedRawTitle: 'Adult Game',
  pageType: 'store',
  productType: 'game',
  confidence: 0.9
};

/**
 * All mocks for testing various scenarios
 */
export const ALL_MOCKS = [
  REGULAR_GAME_MOCK,
  DLC_MOCK,
  DEMO_MOCK,
  BUNDLE_MOCK,
  SALE_GAME_MOCK,
  COMMUNITY_MOCK,
  FALLBACK_TITLE_MOCK,
  MALFORMED_MOCK,
  ADULT_CONTENT_MOCK
];

/**
 * Mock Chrome APIs for testing
 */
export const mockChromeAPIs = () => {
  if (typeof global !== 'undefined') {
    global.chrome = {
      runtime: {
        sendMessage: jest.fn().mockResolvedValue({ success: true, data: {} }),
        onMessage: {
          addListener: jest.fn(),
          removeListener: jest.fn()
        }
      },
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({}),
          set: jest.fn().mockResolvedValue(),
          remove: jest.fn().mockResolvedValue()
        }
      }
    };
  }
};

/**
 * Mock performance API
 */
export const mockPerformanceAPI = () => {
  if (typeof global !== 'undefined' && !global.performance) {
    global.performance = {
      now: jest.fn(() => Date.now()),
      memory: {
        usedJSHeapSize: 1024 * 1024,
        totalJSHeapSize: 10 * 1024 * 1024,
        jsHeapSizeLimit: 100 * 1024 * 1024
      }
    } as any;
  }
};

/**
 * Create DOM environment from mock data
 */
export function createMockDOM(mock: SteamPageMock | typeof NON_GAME_MOCK): void {
  // Parse HTML and set up DOM
  document.documentElement.innerHTML = mock.html;

  // Mock window.location
  Object.defineProperty(window, 'location', {
    value: {
      href: mock.url,
      toString: () => mock.url
    },
    writable: true
  });

  // Set document ready state
  Object.defineProperty(document, 'readyState', {
    value: 'complete',
    writable: true
  });
}

/**
 * Clean up DOM after test
 */
export function cleanupMockDOM(): void {
  document.documentElement.innerHTML = '';
}