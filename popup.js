document.addEventListener('DOMContentLoaded', async () => {
  const toggleEditBtn = document.getElementById('toggle-edit');
  const toggleHiddenListBtn = document.getElementById('toggle-hidden-list');
  const hiddenCountTag = document.getElementById('hidden-count-tag');
  const hiddenListPanel = document.getElementById('hidden-list-panel');
  const hiddenItemsContainer = document.getElementById('hidden-items-container');
  const btnReset = document.getElementById('btn-reset');

  let isEditMode = false;
  let isListOpen = false;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url || !tab.url.includes('zendesk.com')) {
    document.body.innerHTML = '<div style="font-size:12px; color:#6C38FF; text-align:center; padding:20px; font-weight:600;">Please switch to an active Zendesk tab.</div>';
    return;
  }

  toggleEditBtn.addEventListener('click', () => {
    isEditMode = !isEditMode;
    chrome.tabs.sendMessage(tab.id, { action: 'toggleEditMode', enable: isEditMode }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[ZVM]', chrome.runtime.lastError.message);
      }
      window.close();
    });
  });

  toggleHiddenListBtn.addEventListener('click', () => {
    isListOpen = !isListOpen;
    hiddenListPanel.classList.toggle('open', isListOpen);
    if (isListOpen) renderHiddenViewsList();
  });

  // Reset to Default: Clears storage & restores original layout cleanly
  btnReset.addEventListener('click', () => {
    chrome.tabs.sendMessage(tab.id, { action: 'resetAll' }, () => {
      if (chrome.runtime.lastError) return;
      syncState();
      if (isListOpen) renderHiddenViewsList();
    });
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'stateUpdated') {
      if (msg.hiddenCount !== undefined) {
        hiddenCountTag.textContent = msg.hiddenCount;
      }
      if (isListOpen) renderHiddenViewsList();
    }
  });

  function renderHiddenViewsList() {
    chrome.storage.local.get(['hiddenViews'], (storage) => {
      const hiddenViews = storage.hiddenViews || [];
      hiddenCountTag.textContent = hiddenViews.length;
      hiddenItemsContainer.innerHTML = '';

      if (hiddenViews.length === 0) {
        hiddenItemsContainer.innerHTML = '<div class="empty-msg">No views are hidden.</div>';
        return;
      }

      hiddenViews.forEach((viewId) => {
        const itemRow = document.createElement('div');
        itemRow.className = 'hidden-item';

        const cleanName = viewId.replace(/^(node|folder)-/, '').replace(/-/g, ' ');

        itemRow.innerHTML = `
          <span style="text-transform: capitalize;">${cleanName}</span>
          <button class="unhide-btn">Unhide</button>
        `;

        itemRow.querySelector('.unhide-btn').addEventListener('click', () => {
          const updatedHidden = hiddenViews.filter(id => id !== viewId);
          chrome.storage.local.set({ hiddenViews: updatedHidden }, () => {
            syncState();
            renderHiddenViewsList();
          });
        });

        hiddenItemsContainer.appendChild(itemRow);
      });
    });
  }

  function syncState() {
    chrome.tabs.sendMessage(tab.id, { action: 'getState' }, (res) => {
      if (chrome.runtime.lastError) return;
      if (res) {
        isEditMode = res.isEditMode;
        toggleEditBtn.textContent = isEditMode ? 'Exit Edit Mode' : 'Enable Edit Mode';
        hiddenCountTag.textContent = res.hiddenCount;
      }
    });
  }

  syncState();
});