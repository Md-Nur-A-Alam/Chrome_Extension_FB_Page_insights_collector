import { ExtensionMessage } from '../shared/types/messages';

console.log('[FB-Analytics] Background Service Worker initialized.');

// Configure Chrome Side Panel behavior where available
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch((err) => {
    console.warn('[FB-Analytics] sidePanel behavior notice:', err);
  });
}

// Global Message Hub: Broadcasts messages between content scripts and UI views
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  console.log('[FB-Analytics] Background received message:', message.type, 'from:', sender.tab?.id || 'extension UI');

  if (message.type === 'SCRAPE_PROGRESS' || message.type === 'SCRAPE_RESULT' || message.type === 'STATE_UPDATE') {
    // Forward broadcast to popup, side panel, and dashboard
    chrome.runtime.sendMessage(message).catch(() => {
      // Ignored if no receiver is active
    });
  }

  sendResponse({ received: true });
  return true;
});
