/**
 * Main Content Script for Facebook Page Content Collector
 * Bridges Popup/Dashboard commands to ScrollManager and Extractors.
 */

(function () {
  console.log('[FB-Collector] Content script loaded on:', window.location.href);

  // Automatically check and resume Phase 2 sequential queue if active
  if (window.__fbScrollManager) {
    window.__fbScrollManager.checkAndResumeQueue();
  }

  /**
   * Helper to detect Facebook Page name & type
   */
  function detectPageInfo() {
    let pageName = 'Facebook Page';
    const path = window.location.pathname;

    // Try finding page title from h1 or meta
    const h1 = document.querySelector('h1');
    if (h1 && h1.textContent.trim().length > 0) {
      pageName = h1.textContent.trim();
    } else {
      const parts = path.split('/').filter(Boolean);
      if (parts.length > 0 && !['watch', 'reel', 'stories', 'groups'].includes(parts[0])) {
        pageName = decodeURIComponent(parts[0]);
      }
    }

    const isReels = path.toLowerCase().includes('/reels') || path.toLowerCase().includes('/reel/');
    const mode = isReels ? 'reels' : 'posts';

    return {
      pageName,
      url: window.location.href,
      mode
    };
  }

  // Listen for messages from Popup and Dashboard
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const manager = window.__fbScrollManager;
    if (!manager) {
      sendResponse({ success: false, error: 'ScrollManager not initialized' });
      return true;
    }

    const { action, payload } = request;

    switch (action) {
      case 'DETECT_PAGE': {
        const info = detectPageInfo();
        sendResponse({ success: true, info });
        break;
      }

      case 'START_COLLECTION': {
        manager.start(payload || {});
        sendResponse({ success: true, status: manager.status, count: manager.getItems().length });
        break;
      }

      case 'PAUSE_COLLECTION': {
        manager.pause();
        sendResponse({ success: true, status: manager.status });
        break;
      }

      case 'RESUME_COLLECTION': {
        manager.resume();
        sendResponse({ success: true, status: manager.status });
        break;
      }

      case 'STOP_COLLECTION': {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ fb_reels_queue_active: false });
        }
        manager.stop();
        sendResponse({ success: true, status: manager.status, items: manager.getItems() });
        break;
      }

      case 'RESET_COLLECTION': {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ fb_reels_queue_active: false, fb_reels_queue: [], fb_reels_queue_index: 0 });
        }
        manager.reset();
        sendResponse({ success: true, status: manager.status });
        break;
      }

      case 'GET_STATE': {
        const info = detectPageInfo();
        sendResponse({
          success: true,
          status: manager.status,
          count: manager.getItems().length,
          targetCount: manager.targetCount,
          items: manager.getItems(),
          info
        });
        break;
      }

      default:
        sendResponse({ success: false, error: `Unknown action: ${action}` });
    }

    return true; // Keep message channel open for async response
  });
})();
