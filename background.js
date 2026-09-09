/**
 * Background Service Worker (Manifest V3)
 * Handles opening the analytical dashboard tab and extension lifecycle events.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('[FB-Collector] Extension installed successfully.');
});

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'OPEN_DASHBOARD') {
    const dashboardUrl = chrome.runtime.getURL('dashboard/dashboard.html');
    
    // Check if dashboard is already open
    chrome.tabs.query({ url: dashboardUrl }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.update(tabs[0].id, { active: true });
        if (tabs[0].windowId) {
          chrome.windows.update(tabs[0].windowId, { focused: true });
        }
      } else {
        chrome.tabs.create({ url: dashboardUrl });
      }
      sendResponse({ success: true });
    });
    return true;
  }
});
