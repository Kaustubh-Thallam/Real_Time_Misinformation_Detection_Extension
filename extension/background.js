// ponytail: background = context menu + message relay. That's it.

// Context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'verify-claim',
    title: 'Verify this claim',
    contexts: ['selection'],
  });
});

// Context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'verify-claim') return;

  const claim = info.selectionText?.trim();
  if (!claim || claim.length < 10) return; // ponytail: too short = skip

  // Sanitize: strip HTML, cap at 2000 chars
  const sanitized = claim.replace(/<[^>]*>/g, '').substring(0, 2000);

  // Store for popup/sidepanel to pick up
  await chrome.storage.session.set({ pending_claim: sanitized });

  // Try to open side panel
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch { /* side panel may not be available */ }

  // Notify any open popup/sidepanel
  chrome.runtime.sendMessage({ type: 'CLAIM_READY', claim: sanitized }).catch(() => {});
});

// Relay messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'VERIFY_CLAIM') {
    chrome.storage.session.set({ pending_claim: msg.claim });
    chrome.runtime.sendMessage({ type: 'CLAIM_READY', claim: msg.claim }).catch(() => {});
  }
});
