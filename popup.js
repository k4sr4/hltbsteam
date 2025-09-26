document.addEventListener('DOMContentLoaded', async () => {
  // Load current settings
  const response = await chrome.runtime.sendMessage({ action: 'getSettings' });

  if (response.success) {
    const { settings } = response;
    document.getElementById('enableToggle').checked = settings.enabled;
    document.getElementById('cacheToggle').checked = settings.cacheEnabled;
  }

  // Handle enable toggle
  document.getElementById('enableToggle').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ enabled: e.target.checked });
    showStatus(e.target.checked ? 'Extension enabled' : 'Extension disabled');
  });

  // Handle cache toggle
  document.getElementById('cacheToggle').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ cacheEnabled: e.target.checked });
    showStatus(e.target.checked ? 'Cache enabled' : 'Cache disabled');
  });

  // Handle clear cache button
  document.getElementById('clearCacheBtn').addEventListener('click', async () => {
    const response = await chrome.runtime.sendMessage({ action: 'clearCache' });
    if (response.success) {
      showStatus(`Cleared ${response.cleared} cache entries`);
    }
  });

  // Handle report issue link
  document.getElementById('reportIssue').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: 'https://github.com/yourusername/hltb-steam/issues'
    });
  });
});

function showStatus(message) {
  const statusEl = document.getElementById('statusMessage');
  statusEl.textContent = message;
  statusEl.style.display = 'block';
  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 3000);
}