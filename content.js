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

    if (hltbResponse.success) {
      console.log('[HLTB] Data received:', hltbResponse.data);
      injectHLTBData(hltbResponse.data);
    } else {
      console.error('[HLTB] Failed to fetch data:', hltbResponse.error);
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

  // Extract game title
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const gameTitle = ogTitle?.content || document.title.split(' on Steam')[0];

  return {
    appId: appIdMatch[1],
    title: gameTitle.trim()
  };
}

function injectHLTBData(data) {
  // Sanitize data to prevent XSS
  const sanitizeData = (str) => {
    if (typeof str !== 'string') return 'N/A';
    return str.replace(/[<>"'&]/g, (match) => {
      const entities = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      };
      return entities[match];
    });
  };

  // Create container element safely
  const container = document.createElement('div');
  container.className = 'hltb-container';

  // Create header
  const header = document.createElement('div');
  header.className = 'hltb-header';

  const logo = document.createElement('span');
  logo.className = 'hltb-logo';
  logo.textContent = 'HLTB';

  const title = document.createElement('span');
  title.className = 'hltb-title';
  title.textContent = 'HowLongToBeat';

  header.appendChild(logo);
  header.appendChild(title);

  // Create times container
  const timesContainer = document.createElement('div');
  timesContainer.className = 'hltb-times';

  // Create time boxes safely
  const timeBoxes = [
    { label: 'Main Story', value: sanitizeData(data.mainStory) },
    { label: 'Main + Extra', value: sanitizeData(data.mainExtra) },
    { label: 'Completionist', value: sanitizeData(data.completionist) }
  ];

  timeBoxes.forEach(({ label, value }) => {
    const timeBox = document.createElement('div');
    timeBox.className = 'hltb-time-box';

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

  container.appendChild(header);
  container.appendChild(timesContainer);

  // Find injection point (simplified)
  const purchaseArea = document.querySelector('.game_area_purchase');
  if (purchaseArea) {
    purchaseArea.parentNode.insertBefore(container, purchaseArea);
    console.log('[HLTB] UI injected successfully');
  } else {
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