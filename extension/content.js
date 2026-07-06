// ponytail: content script only grabs selected text and sends to background. No DOM mutation.

// Listen for messages from background asking for selected text
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_SELECTION') {
    const text = window.getSelection()?.toString()?.trim() || '';
    sendResponse({ text });
  }
  return true; // async response
});
