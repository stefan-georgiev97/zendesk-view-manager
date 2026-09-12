// Service worker handles background messaging routing cleanly
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // If needed for background extension messaging state
  if (msg.action === 'ping') {
    sendResponse({ status: 'ok' });
  }
});