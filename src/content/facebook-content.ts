import { ExtensionMessage, ScrapeProgress } from '../shared/types/messages';
import { PageDetector } from './page-detector';
import { ContentScanner } from './scanner';

console.log('[FB-Analytics] Content script loaded on:', window.location.href);

let activeScanner: ContentScanner | null = null;

// Send progress update to background and any active UI listeners (Popup / SidePanel)
function broadcastProgress(progress: ScrapeProgress) {
  chrome.runtime.sendMessage({
    type: 'SCRAPE_PROGRESS',
    payload: progress
  }).catch(() => {
    // Suppress errors when popup or side panel is closed
  });
}

// Message Listener for Chrome Extension commands
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'DETECT_PAGE') {
    const { page, mode } = PageDetector.detect();
    sendResponse({
      type: 'PAGE_DETECTED',
      payload: { page, mode }
    });
    return true;
  }

  if (message.type === 'START_SCRAPE') {
    if (activeScanner) {
      activeScanner.cancel();
    }

    activeScanner = new ContentScanner({
      onProgress: (progress) => broadcastProgress(progress)
    });

    activeScanner.start(message.payload).then((items) => {
      sendResponse({ type: 'SCRAPE_RESULT', payload: items });
    }).catch((err) => {
      console.error('[FB-Analytics] Scrape failed:', err);
    });

    sendResponse({ status: 'started' });
    return true;
  }

  if (message.type === 'PAUSE_SCRAPE') {
    if (activeScanner) {
      activeScanner.pause();
    }
    sendResponse({ status: 'paused' });
    return true;
  }

  if (message.type === 'RESUME_SCRAPE') {
    if (activeScanner) {
      activeScanner.resume();
    }
    sendResponse({ status: 'resumed' });
    return true;
  }

  if (message.type === 'CANCEL_SCRAPE') {
    if (activeScanner) {
      activeScanner.cancel();
      activeScanner = null;
    }
    sendResponse({ status: 'cancelled' });
    return true;
  }

  return false;
});
