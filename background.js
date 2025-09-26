console.log('[HLTB] Background service worker started');

// Message handler for content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[HLTB] Received message:', request.action);

  switch(request.action) {
    case 'fetchHLTB':
      handleFetchHLTB(request, sendResponse);
      return true; // Will respond asynchronously

    case 'getSettings':
      handleGetSettings(sendResponse);
      return true;

    case 'clearCache':
      handleClearCache(sendResponse);
      return true;

    default:
      console.warn('[HLTB] Unknown action:', request.action);
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Handle HLTB data fetching
async function handleFetchHLTB(request, sendResponse) {
  try {
    const { gameTitle, appId } = request;

    // Validate inputs
    if (!appId || typeof appId !== 'string' || !/^\d+$/.test(appId)) {
      sendResponse({ success: false, error: 'Invalid app ID' });
      return;
    }

    if (!gameTitle || typeof gameTitle !== 'string' || gameTitle.length > 200) {
      sendResponse({ success: false, error: 'Invalid game title' });
      return;
    }

    // Sanitize appId for cache key
    const sanitizedAppId = appId.replace(/[^0-9]/g, '').substring(0, 20);
    const cacheKey = `hltb_${sanitizedAppId}`;

    // Check cache first
    const cached = await chrome.storage.local.get(cacheKey);

    if (cached[cacheKey] && !isCacheExpired(cached[cacheKey])) {
      console.log('[HLTB] Using cached data for:', gameTitle.substring(0, 50));
      sendResponse({ success: true, data: cached[cacheKey].data });
      return;
    }

    // Fetch fresh data (implementation in later PRD)
    console.log('[HLTB] Fetching fresh data for:', gameTitle.substring(0, 50));
    // Placeholder for actual HLTB fetching
    const hltbData = {
      mainStory: '12 Hours',
      mainExtra: '24 Hours',
      completionist: '48 Hours'
    };

    // Validate response data before caching
    const validatedData = {
      mainStory: validateTimeString(hltbData.mainStory),
      mainExtra: validateTimeString(hltbData.mainExtra),
      completionist: validateTimeString(hltbData.completionist)
    };

    // Cache the result with sanitized data
    await chrome.storage.local.set({
      [cacheKey]: {
        data: validatedData,
        timestamp: Date.now(),
        gameTitle: gameTitle.substring(0, 100) // Limit stored title length
      }
    });

    sendResponse({ success: true, data: validatedData });

  } catch (error) {
    console.error('[HLTB] Error fetching data:', error);
    sendResponse({ success: false, error: 'Failed to fetch data' });
  }
}

// Validate time strings to prevent XSS
function validateTimeString(timeStr) {
  if (typeof timeStr !== 'string') return 'N/A';
  // Only allow alphanumeric chars, spaces, and common time units
  const sanitized = timeStr.replace(/[^a-zA-Z0-9\s\-\.]/g, '').substring(0, 50);
  return sanitized || 'N/A';
}

// Get extension settings
async function handleGetSettings(sendResponse) {
  try {
    const settings = await chrome.storage.local.get(['enabled', 'cacheEnabled', 'theme']);
    sendResponse({
      success: true,
      settings: {
        enabled: settings.enabled !== false, // Default true
        cacheEnabled: settings.cacheEnabled !== false, // Default true
        theme: settings.theme || 'auto'
      }
    });
  } catch (error) {
    console.error('[HLTB] Error getting settings:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Clear cache
async function handleClearCache(sendResponse) {
  try {
    const keys = await chrome.storage.local.get(null);
    const cacheKeys = Object.keys(keys).filter(key => key.startsWith('hltb_'));
    await chrome.storage.local.remove(cacheKeys);
    console.log('[HLTB] Cleared cache entries:', cacheKeys.length);
    sendResponse({ success: true, cleared: cacheKeys.length });
  } catch (error) {
    console.error('[HLTB] Error clearing cache:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Check if cache entry is expired (7 days)
function isCacheExpired(cacheEntry) {
  const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
  return Date.now() - cacheEntry.timestamp > CACHE_DURATION;
}

// Set up alarm for periodic cache cleanup
chrome.alarms.create('cleanupCache', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanupCache') {
    cleanupExpiredCache();
  }
});

// Remove expired cache entries
async function cleanupExpiredCache() {
  const storage = await chrome.storage.local.get(null);
  const expiredKeys = [];

  for (const [key, value] of Object.entries(storage)) {
    if (key.startsWith('hltb_') && isCacheExpired(value)) {
      expiredKeys.push(key);
    }
  }

  if (expiredKeys.length > 0) {
    await chrome.storage.local.remove(expiredKeys);
    console.log('[HLTB] Cleaned up expired cache entries:', expiredKeys.length);
  }
}

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[HLTB] Extension installed:', details.reason);

  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.local.set({
      enabled: true,
      cacheEnabled: true,
      theme: 'auto',
      installDate: Date.now()
    });

    // Open welcome page (optional)
    // chrome.tabs.create({ url: 'welcome.html' });
  }
});