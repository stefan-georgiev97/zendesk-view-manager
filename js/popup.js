document.addEventListener('DOMContentLoaded', async () => {
  const viewMain = document.getElementById('view-main');
  const viewSound = document.getElementById('view-sound');
  
  const toggleEditBtn = document.getElementById('toggle-edit');
  const toggleHiddenListBtn = document.getElementById('toggle-hidden-list');
  const hiddenCountTag = document.getElementById('hidden-count-tag');
  const hiddenListPanel = document.getElementById('hidden-list-panel');
  const hiddenItemsContainer = document.getElementById('hidden-items-container');
  const btnReset = document.getElementById('btn-reset');

  const autoRefreshToggle = document.getElementById('toggle-autorefresh');
  const refreshOptionsPanel = document.getElementById('refresh-options-panel');
  const refreshIntervalVal = document.getElementById('refresh-interval-val');
  const refreshIntervalUnit = document.getElementById('refresh-interval-unit');

  const badgeToggle = document.getElementById('toggle-badge');
  const soundToggle = document.getElementById('toggle-sound');
  const btnOpenSoundPanel = document.getElementById('btn-open-sound-panel');
  const btnBackToMain = document.getElementById('btn-back-to-main');
  const soundRadioList = document.getElementById('sound-radio-list');

  let isEditMode = false;
  let isListOpen = false;

  const SOUND_KEYS = [
    'default', 'alert', 'bonk', 'cell_sms', 'door_knock', 'dong', 
    'fog_horn', 'indian_brass', 'incoming_im', 'moo', 'oh_oh', 
    'outgoing_im', 'rubber_duckies', 'space', 'teaser', 'whip', 
    'whistle', 'whizz', 'window_flipped', 'crunch', 'flute', 'triplet'
  ];

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url || !tab.url.includes('zendesk.com')) {
    document.body.innerHTML = '<div style="font-size:12px; color:#6C38FF; text-align:center; padding:20px; font-weight:600;">Please switch to an active Zendesk tab.</div>';
    return;
  }

  // Sync initial state directly from tab content script
  syncState();

  // Hydrate settings
  chrome.storage.local.get(['hiddenViews', 'autoRefreshEnabled', 'autoRefreshVal', 'autoRefreshUnit', 'badgeEnabled', 'soundEnabled', 'selectedSound'], (settings) => {
    const hidden = settings.hiddenViews || [];
    hiddenCountTag.textContent = hidden.length;

    const isAutoOn = Boolean(settings.autoRefreshEnabled);
    autoRefreshToggle.checked = isAutoOn;
    refreshOptionsPanel.classList.toggle('open', isAutoOn);

    if (settings.autoRefreshVal) refreshIntervalVal.value = settings.autoRefreshVal;
    if (settings.autoRefreshUnit) refreshIntervalUnit.value = settings.autoRefreshUnit;

    badgeToggle.checked = Boolean(settings.badgeEnabled);
    
    const isSoundOn = Boolean(settings.soundEnabled);
    soundToggle.checked = isSoundOn;
    btnOpenSoundPanel.style.display = isSoundOn ? 'inline-block' : 'none';

    renderSoundRadioList(settings.selectedSound || 'default');
  });

  function triggerSoundPreview(soundKey) {
    const BASE_CDN = 'https://static.zdassets.com/agent/assets/react/js/';
    const SOUND_LIBRARY = {
      default: `${BASE_CDN}default-notification.117262b9..mp3`,
      alert: `${BASE_CDN}ALERT.d1214668..mp3`,
      bonk: `${BASE_CDN}BONK.e680e9f7..mp3`,
      cell_sms: `${BASE_CDN}CELL_SMS.b0fc800c..mp3`,
      door_knock: `${BASE_CDN}DOOR_KNOCK.78c51ee3..mp3`,
      dong: `${BASE_CDN}DONG.117262b9..mp3`,
      fog_horn: `${BASE_CDN}FOG_HORN.6644781e..mp3`,
      indian_brass: `${BASE_CDN}INDIAN_BRASS.1b8141a6..mp3`,
      incoming_im: `${BASE_CDN}INCOMING_IM.4c1976ce..mp3`,
      moo: `${BASE_CDN}MOO.22bbb48d..mp3`,
      oh_oh: `${BASE_CDN}OH_OH.1963146c..mp3`,
      outgoing_im: `${BASE_CDN}OUTGOING_IM.6cde305e..mp3`,
      rubber_duckies: `${BASE_CDN}RUBBER_DUCKIES.a1f70e04..mp3`,
      space: `${BASE_CDN}SPACE.ee01e78d..mp3`,
      teaser: `${BASE_CDN}TEASER.3fb940c2..mp3`,
      whip: `${BASE_CDN}WHIP.05147994..mp3`,
      whistle: `${BASE_CDN}WHISTLE.504b041e..mp3`,
      whizz: `${BASE_CDN}WHIZZ.6163b5a7..mp3`,
      window_flipped: `${BASE_CDN}WINDOW_FLIPPED.5aac8f38..mp3`,
      bright: `${BASE_CDN}Bright.9d25aca4..mp3`,
      crunch: `${BASE_CDN}CRUNCH.db85c0dc..mp3`,
      dotdot: `${BASE_CDN}DOTDOT.56a84e74..mp3`,
      flute: `${BASE_CDN}FLUTE.c1b0dd4c..mp3`,
      triplet: `${BASE_CDN}TRIPLET.00abc1d1..mp3`
    };

    const url = SOUND_LIBRARY[soundKey] || SOUND_LIBRARY['default'];
    const audio = new Audio(url);
    audio.volume = 0.6;
    audio.play().catch((err) => console.warn('[ZVM] Popup audio preview error:', err));
  }

  function renderSoundRadioList(activeSound) {
    soundRadioList.innerHTML = '';

    SOUND_KEYS.forEach((key) => {
      const row = document.createElement('div');
      row.className = 'sound-radio-row';
      const cleanName = key.replace(/_/g, ' ');

      row.innerHTML = `
        <label class="radio-label-group" for="radio-${key}">
          <input type="radio" id="radio-${key}" name="zvm-sound-option" value="${key}" ${key === activeSound ? 'checked' : ''}>
          <span>${cleanName}</span>
        </label>
        <button class="btn-sound-test" data-sound="${key}">▶ Test</button>
      `;

      const radioInput = row.querySelector('input[type="radio"]');

      row.addEventListener('click', (e) => {
        if (e.target.closest('.btn-sound-test')) return;

        radioInput.checked = true;
        chrome.storage.local.set({ selectedSound: key });
        triggerSoundPreview(key);
      });

      row.querySelector('.btn-sound-test').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        triggerSoundPreview(key);
      });

      soundRadioList.appendChild(row);
    });
  }

  btnOpenSoundPanel.addEventListener('click', () => {
    viewMain.classList.remove('active');
    viewSound.classList.add('active');
  });

  btnBackToMain.addEventListener('click', () => {
    viewSound.classList.remove('active');
    viewMain.classList.add('active');
  });

  soundToggle.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    btnOpenSoundPanel.style.display = isChecked ? 'inline-block' : 'none';
    chrome.storage.local.set({ soundEnabled: isChecked });
  });

  toggleEditBtn.addEventListener('click', () => {
    const targetState = !isEditMode;
    chrome.tabs.sendMessage(tab.id, { action: 'toggleEditMode', enable: targetState }, (response) => {
      if (chrome.runtime.lastError) {
        const _ignored = chrome.runtime.lastError;
      }
      setTimeout(() => window.close(), 50); // Slight delay to ensure message delivery before popup destruction
    });
  });

  autoRefreshToggle.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    refreshOptionsPanel.classList.toggle('open', isChecked);
    saveRefreshSettings();
  });

  refreshIntervalVal.addEventListener('change', saveRefreshSettings);
  refreshIntervalUnit.addEventListener('change', saveRefreshSettings);

  function saveRefreshSettings() {
    let val = parseInt(refreshIntervalVal.value, 10);
    const unit = refreshIntervalUnit.value;

    if (isNaN(val) || val < 1) val = 1;
    if (unit === 'seconds' && val < 15) val = 15;

    refreshIntervalVal.value = val;

    chrome.storage.local.set({
      autoRefreshEnabled: autoRefreshToggle.checked,
      autoRefreshVal: val,
      autoRefreshUnit: unit
    });
  }

  badgeToggle.addEventListener('change', (e) => {
    chrome.storage.local.set({ badgeEnabled: e.target.checked });
  });

  toggleHiddenListBtn.addEventListener('click', () => {
    isListOpen = !isListOpen;
    hiddenListPanel.classList.toggle('open', isListOpen);
    if (isListOpen) renderHiddenViewsList();
  });

  btnReset.addEventListener('click', () => {
    chrome.tabs.sendMessage(tab.id, { action: 'resetAll' }, () => {
      if (chrome.runtime.lastError) return;
      syncState();
      if (isListOpen) renderHiddenViewsList();
    });
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
});