console.log('[HLTB] Content script loaded on:', window.location.href);

// Check if we're on a Steam game page
if (isGamePage()) {
  initializeExtension();
}

function isGamePage() {
  const url = window.location.href;
  return (
    url.includes('store.steampowered.com/app/') ||
    url.includes('steamcommunity.com/app/')
  );
}

async function initializeExtension() {
  try {
    // Check if extension is enabled
    const response = await chrome.runtime.sendMessage({ action: 'getSettings' });

    if (!response.success || !response.settings.enabled) {
      console.log('[HLTB] Extension is disabled');
      return;
    }

    // Extract game info (simplified for foundation)
    const gameInfo = extractGameInfo();
    if (!gameInfo) {
      console.warn('[HLTB] Could not extract game info');
      return;
    }

    console.log('[HLTB] Game detected:', gameInfo);

    // Request HLTB data
    const hltbResponse = await chrome.runtime.sendMessage({
      action: 'fetchHLTB',
      gameTitle: gameInfo.title,
      appId: gameInfo.appId
    });

    if (hltbResponse.success && hltbResponse.data) {
      console.log('[HLTB] Data received:', hltbResponse.data);
      injectHLTBData(hltbResponse.data);
    } else {
      console.error('[HLTB] Failed to fetch data:', hltbResponse.error || 'No data returned');
    }

  } catch (error) {
    console.error('[HLTB] Extension error:', error);
  }
}

function extractGameInfo() {
  // Extract app ID from URL
  const url = window.location.href;
  const appIdMatch = url.match(/\/app\/(\d+)/);
  if (!appIdMatch) return null;

  let gameTitle = '';

  // Strategy 1: Extract from URL (most reliable)
  // URL format: /app/1145350/Hades_II/
  const urlTitleMatch = url.match(/\/app\/\d+\/([^\/\?#]+)/);
  if (urlTitleMatch) {
    gameTitle = urlTitleMatch[1]
      .replace(/_/g, ' ')  // Replace underscores with spaces
      .replace(/%20/g, ' ') // Replace URL encoded spaces
      .trim();
  }

  // Strategy 2: Try app name element (community pages)
  if (!gameTitle) {
    const appNameElement = document.querySelector('#appHubAppName');
    if (appNameElement) {
      gameTitle = appNameElement.textContent.trim();
    }
  }

  // Strategy 3: Fallback to meta tag with cleanup
  if (!gameTitle) {
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle?.content) {
      gameTitle = ogTitle.content
        .replace(/ on Steam$/, '')        // Remove " on Steam" suffix
        .replace(/^Save \d+% on /, '')    // Remove "Save X% on " prefix
        .trim();
    }
  }

  // Strategy 4: Last resort - document title
  if (!gameTitle) {
    gameTitle = document.title
      .replace(/ on Steam$/, '')
      .replace(/^Save \d+% on /, '')
      .trim();
  }

  return {
    appId: appIdMatch[1],
    title: gameTitle
  };
}

function injectHLTBData(data) {
  // Helper to format hours properly
  const formatHours = (hours) => {
    if (hours === null || hours === undefined) {
      return '--';
    }
    if (typeof hours === 'number') {
      if (hours === 0) return '--';
      return hours + (hours === 1 ? ' Hour' : ' Hours');
    }
    // For legacy string format
    if (typeof hours === 'string') {
      return hours || '--';
    }
    return '--';
  };

  // Create container element safely
  const container = document.createElement('div');
  container.className = 'hltb-container';

  // Add data source attribute for styling
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
    const sourceText = data.source === 'cache' ? 'cached' :
                      data.source === 'scraper' ? 'scraped' :
                      data.source === 'fallback' ? 'estimated' : '';
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

  // Create time boxes safely
  const timeBoxes = [
    { label: 'Main Story', value: formatHours(data.mainStory) },
    { label: 'Main + Extra', value: formatHours(data.mainExtra) },
    { label: 'Completionist', value: formatHours(data.completionist) }
  ];

  // Check if this is a multiplayer-only game (all times are null)
  const isMultiplayerOnly = data.mainStory === null &&
                            data.mainExtra === null &&
                            data.completionist === null;

  if (isMultiplayerOnly) {
    // Show special message for multiplayer games
    const multiplayerBox = document.createElement('div');
    multiplayerBox.className = 'hltb-multiplayer-notice';
    multiplayerBox.textContent = 'Multiplayer Game - No completion times';
    timesContainer.appendChild(multiplayerBox);
  } else {
    // Show regular time boxes
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

  // Find injection point - try multiple selectors for Store and Community pages
  const injectionSelectors = [
    '.game_area_purchase',          // Store page - before purchase area
    '.game_area_purchase_game',     // Store page - alternative selector
    '.apphub_AppName',              // Community page - after app name
    '.apphub_HomeHeader',           // Community page - header area
    '.rightcol',                    // Store page - right column
    '.game_meta_data',              // Store page - meta area
    '#appHubAppName'                // Community page - app hub name
  ];

  let injected = false;
  for (const selector of injectionSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      // For community pages, inject after the header; for store pages, before purchase area
      if (selector.includes('apphub') || selector.includes('appHub')) {
        // Community page - insert after the header element
        element.parentNode.insertBefore(container, element.nextSibling);
      } else {
        // Store page - insert before the element
        element.parentNode.insertBefore(container, element);
      }
      console.log('[HLTB] UI injected successfully at:', selector);
      injected = true;
      break;
    }
  }

  if (!injected) {
    console.warn('[HLTB] Could not find injection point');
  }
}

// Handle dynamic navigation (Steam is a SPA)
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    console.log('[HLTB] Navigation detected');
    if (isGamePage()) {
      initializeExtension();
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});