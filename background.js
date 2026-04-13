// XCard Background Service Worker
// Handles: auth, Grok API, avatar proxy

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ status: 'ok' });
  }
  return true;
});

console.log('[XCard] Service worker started');
