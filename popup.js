document.addEventListener('DOMContentLoaded', async () => {
  const countBadge = document.getElementById('hidden-count');
  const toggleEditBtn = document.getElementById('toggle-edit');
  const btnSave = document.getElementById('btn-save');
  const btnReset = document.getElementById('btn-reset');

  let isEditMode = false;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url || !tab.url.includes('zendesk.com')) {
    document.body.innerHTML = '<div style="font-size:12px; color:#64748b; text-align:center; padding:10px;">Please switch to a Zendesk tab.</div>';
    return;
  }

  // Toggle Edit Mode on Zendesk Page
  toggleEditBtn.addEventListener('click', () => {
    isEditMode = !isEditMode;
    updateEditButtonUI(isEditMode);
    chrome.tabs.sendMessage(tab.id, { action: 'toggleEditMode', enable: isEditMode });
  });

  // Save Pending Order & Draft Hidden States
  btnSave.addEventListener('click', () => {
    chrome.tabs.sendMessage(tab.id, { action: 'saveChanges' }, () => {
      isEditMode = false;
      updateEditButtonUI(false);
      setSaveButtonState(false);
      syncState();
    });
  });

  // Reset to Zendesk Native Defaults
  btnReset.addEventListener('click', () => {
    if (confirm('Reset view order and restore all hidden views?')) {
      chrome.tabs.sendMessage(tab.id, { action: 'resetAll' }, () => {
        isEditMode = false;
        updateEditButtonUI(false);
        setSaveButtonState(false);
        syncState();
      });
    }
  });

  // Listen for live updates happening on Zendesk page
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'stateUpdated') {
      setSaveButtonState(msg.hasUnsavedChanges);
      if (msg.hiddenCount !== undefined) {
        countBadge.textContent = `${msg.hiddenCount} Hidden`;
      }
    }
  });

  function updateEditButtonUI(enabled) {
    toggleEditBtn.classList.toggle('active', enabled);
    toggleEditBtn.textContent = enabled ? '🔒 Exit Edit Mode' : '✏️ Enable Edit Mode';
  }

  function setSaveButtonState(enabled) {
    btnSave.disabled = !enabled;
    btnSave.textContent = enabled ? '💾 Save Changes *' : '💾 Save Changes';
  }

  function syncState() {
    chrome.tabs.sendMessage(tab.id, { action: 'getState' }, (res) => {
      if (res) {
        isEditMode = res.isEditMode;
        updateEditButtonUI(isEditMode);
        setSaveButtonState(res.hasUnsavedChanges);
        countBadge.textContent = `${res.hiddenCount} Hidden`;
      }
    });
  }

  syncState();
});