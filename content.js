console.log('[ZVM] Content script active.');

let savedHiddenViewIds = new Set();
let pendingHiddenViewIds = new Set();
let savedViewOrder = [];
let pendingViewOrder = [];

let isEditMode = false;
let isDragging = false;
let defaultOriginalOrder = [];
let dropIndicator = null;
let observer = null;

// --- AUDIO PLAYBACK ENGINE (DOM-Safe) ---
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

function playSelectedSound(soundKey) {
  const url = SOUND_LIBRARY[soundKey] || SOUND_LIBRARY['default'];
  const audio = new Audio(url);
  audio.volume = 0.6;
  audio.play().catch((err) => console.warn('[ZVM] Audio playback error:', err));
}

const SVG_EYE_OPEN = `<svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;
const SVG_EYE_SLASH = `<svg viewBox="0 0 24 24"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.44-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.17c0-1.66-1.34-3-3-3l-.17.02z"/></svg>`;

function getViewItems() {
  return document.querySelectorAll('nav[aria-label="Views"] li[type="node"], nav[aria-label="Views"] li[type="folder"]');
}

function getObserverTarget() {
  return document.querySelector('nav[aria-label="Views"]') || 
         document.querySelector('[data-test-id="views_views-pane_content"]') || 
         document.body;
}

function execWithoutObserver(fn) {
  if (observer) observer.disconnect();
  try {
    fn();
  } finally {
    if (observer) {
      observer.takeRecords();
      observer.observe(getObserverTarget(), { childList: true, subtree: true });
    }
  }
}

function getViewName(liElement) {
  const ariaLabelDiv = liElement.querySelector('[aria-describedby]');
  if (ariaLabelDiv && ariaLabelDiv.textContent.trim()) {
    return ariaLabelDiv.textContent.trim();
  }

  const tooltipDiv = liElement.querySelector('[data-garden-container-id="containers.tooltip"]');
  if (tooltipDiv && tooltipDiv.textContent.trim()) {
    return tooltipDiv.textContent.trim();
  }

  const textHolder = liElement.querySelector('a div, button div');
  if (textHolder && textHolder.textContent.trim()) {
    return textHolder.textContent.trim();
  }

  return null;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function captureDefaultOrder() {
  if (defaultOriginalOrder.length > 0) return;
  const items = getViewItems();
  items.forEach((li) => {
    const name = getViewName(li);
    if (!name) return;
    const type = li.getAttribute('type') || (li.classList.contains('expanded') ? 'folder' : 'node');
    const id = `${type}-${slugify(name)}`;
    defaultOriginalOrder.push(id);
  });
}

function getDropIndicator() {
  if (!dropIndicator) {
    dropIndicator = document.createElement('div');
    dropIndicator.className = 'zvm-drop-indicator';
  }
  return dropIndicator;
}

function updateFloatingToolbar(enable) {
  let toolbar = document.getElementById('zvm-page-toolbar');

  if (enable) {
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = 'zvm-page-toolbar';

      toolbar.innerHTML = `
        <span style="font-weight:600;">View Manager</span>
        <span id="zvm-tb-badge" class="zvm-tb-badge">${pendingHiddenViewIds.size} Hidden</span>
        <button id="zvm-tb-save" class="zvm-tb-save" disabled>💾 Save</button>
        <button id="zvm-tb-reset">↺ Reset</button>
        <button id="zvm-tb-cancel" class="zvm-tb-cancel">✖ Exit</button>
      `;

      document.body.appendChild(toolbar);

      toolbar.querySelector('#zvm-tb-save').addEventListener('click', saveChanges);
      toolbar.querySelector('#zvm-tb-reset').addEventListener('click', resetDraftsKeepEditMode);

      toolbar.querySelector('#zvm-tb-cancel').addEventListener('click', () => {
        execWithoutObserver(() => {
          pendingViewOrder = [...savedViewOrder];
          pendingHiddenViewIds = new Set(savedHiddenViewIds);
          updateEditModeUI(false);
          applyCustomLayout(savedViewOrder, savedHiddenViewIds);
        });
      });
    }

    const saveBtn = toolbar.querySelector('#zvm-tb-save');
    const badge = toolbar.querySelector('#zvm-tb-badge');

    const hasOrderChanges = JSON.stringify(pendingViewOrder) !== JSON.stringify(savedViewOrder);
    const hasHideChanges = JSON.stringify(Array.from(pendingHiddenViewIds).sort()) !== JSON.stringify(Array.from(savedHiddenViewIds).sort());
    const isDirty = hasOrderChanges || hasHideChanges;

    saveBtn.disabled = !isDirty;
    saveBtn.textContent = isDirty ? '💾 Save *' : '💾 Save';
    badge.textContent = `${pendingHiddenViewIds.size} Hidden`;

  } else {
    if (toolbar) toolbar.remove();
  }
}

function attachDragListeners(li, isSubNode) {
  const rowWrapper = li.firstElementChild || li;
  let dragHandle = rowWrapper.querySelector('.zvm-page-drag-handle');
  const innerLink = li.querySelector('a');

  li.classList.add('zvm-draggable');
  li.draggable = true;

  if (innerLink) {
    innerLink.setAttribute('draggable', 'false');
  }

  if (!dragHandle) {
    dragHandle = document.createElement('span');
    dragHandle.className = `zvm-page-drag-handle ${isSubNode ? 'sub-node-handle' : 'root-handle'}`;
    dragHandle.textContent = '⋮⋮';
    rowWrapper.insertBefore(dragHandle, rowWrapper.firstChild);
  }

  li.ondragstart = (e) => {
    e.stopPropagation();
    isDragging = true;
    li.classList.add('zvm-dragging');
    e.dataTransfer.setData('text/plain', li.dataset.zvmId);
    e.dataTransfer.effectAllowed = 'move';
  };

  li.ondragend = (e) => {
    e.stopPropagation();
    li.classList.remove('zvm-dragging');
    if (dropIndicator && dropIndicator.parentNode) {
      dropIndicator.parentNode.removeChild(dropIndicator);
    }
    updatePendingOrderFromDOM();
    isDragging = false;
  };

  li.ondragover = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const draggingLi = document.querySelector('li.zvm-dragging');
    if (!draggingLi || draggingLi === li) return;

    const draggingIsSubNode = Boolean(draggingLi.parentElement.closest('ul[data-test-id*="children"]'));
    const targetIsSubNode = Boolean(li.parentElement.closest('ul[data-test-id*="children"]'));

    if (draggingIsSubNode !== targetIsSubNode) return;
    if (draggingIsSubNode && draggingLi.parentElement !== li.parentElement) return;

    const bounding = li.getBoundingClientRect();
    const offset = e.clientY - bounding.top - (bounding.height / 2);
    const indicator = getDropIndicator();

    execWithoutObserver(() => {
      if (offset > 0) {
        li.parentNode.insertBefore(draggingLi, li.nextSibling);
        li.parentNode.insertBefore(indicator, li.nextSibling);
      } else {
        li.parentNode.insertBefore(draggingLi, li);
        li.parentNode.insertBefore(indicator, li);
      }
    });
  };
}

function updateEditModeUI(enable) {
  isEditMode = enable;
  document.body.classList.toggle('zvm-edit-mode', enable);

  updateFloatingToolbar(enable);

  const allItems = getViewItems();

  allItems.forEach((li) => {
    const viewId = li.dataset.zvmId;
    const rowWrapper = li.firstElementChild || li;
    let eyeBtn = rowWrapper.querySelector('.zvm-eye-toggle-btn');
    let dragHandle = rowWrapper.querySelector('.zvm-page-drag-handle');
    const innerLink = li.querySelector('a');

    const isSubNode = Boolean(li.parentElement.closest('ul[data-test-id*="children"]'));

    if (enable) {
      const isHiddenInDraft = pendingHiddenViewIds.has(viewId);
      li.classList.toggle('zvm-draft-hidden', isHiddenInDraft);

      if (!eyeBtn && viewId) {
        eyeBtn = document.createElement('button');
        eyeBtn.className = 'zvm-eye-toggle-btn';
        eyeBtn.innerHTML = isHiddenInDraft ? SVG_EYE_SLASH : SVG_EYE_OPEN;
        eyeBtn.title = isHiddenInDraft ? "Click to unhide view" : "Click to hide view";

        eyeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          execWithoutObserver(() => {
            if (pendingHiddenViewIds.has(viewId)) {
              // 1. UNHIDE ACTION: Remove from pending set & instantly restore full opacity
              pendingHiddenViewIds.delete(viewId);
              li.classList.remove('zvm-draft-hidden', 'zvm-hidden'); 
              eyeBtn.innerHTML = SVG_EYE_OPEN;
              eyeBtn.title = "Click to hide view";
            } else {
              // 2. HIDE ACTION: Add to pending set & instantly dim row
              pendingHiddenViewIds.add(viewId);
              li.classList.add('zvm-draft-hidden');
              eyeBtn.innerHTML = SVG_EYE_SLASH;
              eyeBtn.title = "Click to unhide view";
            }
            
            notifyStateChange();
          });
        });

        const targetAnchor = rowWrapper.querySelector('a') || rowWrapper;
        targetAnchor.appendChild(eyeBtn);
      } else if (eyeBtn) {
        eyeBtn.innerHTML = isHiddenInDraft ? SVG_EYE_SLASH : SVG_EYE_OPEN;
        eyeBtn.title = isHiddenInDraft ? "Click to unhide view" : "Click to hide view";
      }

      attachDragListeners(li, isSubNode);

    } else {
      li.classList.remove('zvm-draggable', 'zvm-draft-hidden');
      li.draggable = false;
      if (innerLink) innerLink.removeAttribute('draggable');
      if (dragHandle) dragHandle.remove();
      if (eyeBtn) eyeBtn.remove();
      li.ondragstart = null;
      li.ondragend = null;
      li.ondragover = null;
    }
  });
}

function updatePendingOrderFromDOM() {
  const allItems = getViewItems();
  const currentOrder = [];

  allItems.forEach((li) => {
    if (li.dataset.zvmId) {
      currentOrder.push(li.dataset.zvmId);
    }
  });

  pendingViewOrder = currentOrder;
  notifyStateChange();
}

function notifyStateChange() {
  updateFloatingToolbar(isEditMode);

  const hasOrderChanges = JSON.stringify(pendingViewOrder) !== JSON.stringify(savedViewOrder);
  const hasHideChanges = JSON.stringify(Array.from(pendingHiddenViewIds).sort()) !== JSON.stringify(Array.from(savedHiddenViewIds).sort());

  chrome.runtime.sendMessage({ 
    action: 'stateUpdated', 
    hasUnsavedChanges: hasOrderChanges || hasHideChanges,
    hiddenCount: pendingHiddenViewIds.size
  });
}

function saveChanges() {
  execWithoutObserver(() => {
    savedViewOrder = [...pendingViewOrder];
    savedHiddenViewIds = new Set(pendingHiddenViewIds);

    chrome.storage.local.set({ 
      viewOrder: savedViewOrder,
      hiddenViews: Array.from(savedHiddenViewIds)
    }, () => {
      updateEditModeUI(false);
      applyCustomLayout(savedViewOrder, savedHiddenViewIds);
    });
  });
}

function resetDraftsKeepEditMode() {
  execWithoutObserver(() => {
    pendingViewOrder = [...defaultOriginalOrder];
    pendingHiddenViewIds = new Set();
    savedViewOrder = [];
    savedHiddenViewIds = new Set();

    chrome.storage.local.remove(['viewOrder', 'hiddenViews'], () => {
      applyCustomLayout(defaultOriginalOrder, pendingHiddenViewIds);
      updateEditModeUI(true);
      notifyStateChange();
    });
  });
}

function hardResetToDefault() {
  execWithoutObserver(() => {
    savedViewOrder = [];
    pendingViewOrder = [];
    savedHiddenViewIds = new Set();
    pendingHiddenViewIds = new Set();

    chrome.storage.local.remove(['viewOrder', 'hiddenViews'], () => {
      updateEditModeUI(false);
      applyCustomLayout(defaultOriginalOrder, savedHiddenViewIds);
      notifyStateChange();
    });
  });
}

function applyCustomLayout(orderToUse = savedViewOrder, hiddenSetToUse = savedHiddenViewIds) {
  captureDefaultOrder();
  const itemsMap = new Map();
  const allListItems = getViewItems();

  allListItems.forEach((li) => {
    const name = getViewName(li);
    if (!name) return;

    const type = li.getAttribute('type') || (li.classList.contains('expanded') ? 'folder' : 'node');
    const id = `${type}-${slugify(name)}`;
    li.dataset.zvmId = id;

    if (hiddenSetToUse.has(id)) {
      li.classList.add('zvm-hidden');
    } else {
      li.classList.remove('zvm-hidden');
    }

    itemsMap.set(id, li);
  });

  if (orderToUse && orderToUse.length > 0 && itemsMap.size > 0) {
    orderToUse.forEach((id) => {
      const li = itemsMap.get(id);
      if (li && li.parentNode) {
        li.parentNode.appendChild(li);
      }
    });
  }
}

chrome.storage.local.get(['hiddenViews', 'viewOrder'], (result) => {
  execWithoutObserver(() => {
    if (result.hiddenViews) {
      savedHiddenViewIds = new Set(result.hiddenViews);
      pendingHiddenViewIds = new Set(result.hiddenViews);
    }
    if (result.viewOrder) {
      savedViewOrder = result.viewOrder;
      pendingViewOrder = [...savedViewOrder];
    }
    applyCustomLayout();
  });
});

chrome.storage.onChanged.addListener((changes) => {
  execWithoutObserver(() => {
    if (changes.hiddenViews) {
      savedHiddenViewIds = new Set(changes.hiddenViews.newValue || []);
      if (!isEditMode) pendingHiddenViewIds = new Set(savedHiddenViewIds);
    }
    if (changes.viewOrder) {
      savedViewOrder = changes.viewOrder.newValue || [];
      if (!isEditMode) pendingViewOrder = [...savedViewOrder];
    }
    applyCustomLayout(isEditMode ? pendingViewOrder : savedViewOrder, isEditMode ? pendingHiddenViewIds : savedHiddenViewIds);
    if (isEditMode) updateEditModeUI(true);
  });
});

observer = new MutationObserver(() => {
  if (isDragging) return;

  execWithoutObserver(() => {
    applyCustomLayout(isEditMode ? pendingViewOrder : savedViewOrder, isEditMode ? pendingHiddenViewIds : savedHiddenViewIds);
    if (isEditMode) updateEditModeUI(true);
  });
});

observer.observe(getObserverTarget(), { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'playChime') {
    if (request.overrideSound) {
      playSelectedSound(request.overrideSound);
    } else {
      chrome.storage.local.get(['selectedSound'], (res) => {
        playSelectedSound(res.selectedSound || 'default');
      });
    }
    sendResponse({ status: 'playing' });
    return true;
  }

  if (request.action === 'getState') {
    chrome.storage.local.get(['hiddenViews'], (result) => {
      const activeHiddenSet = isEditMode ? pendingHiddenViewIds : new Set(result.hiddenViews || Array.from(savedHiddenViewIds));
      const hasOrderChanges = JSON.stringify(pendingViewOrder) !== JSON.stringify(savedViewOrder);
      const hasHideChanges = JSON.stringify(Array.from(pendingHiddenViewIds).sort()) !== JSON.stringify(Array.from(savedHiddenViewIds).sort());

      sendResponse({ 
        isEditMode: isEditMode,
        hiddenCount: activeHiddenSet.size,
        hasUnsavedChanges: hasOrderChanges || hasHideChanges
      });
    });
    return true;
  }

  if (request.action === 'toggleEditMode') {
    execWithoutObserver(() => {
      if (!request.enable && JSON.stringify(pendingViewOrder) !== JSON.stringify(savedViewOrder)) {
        pendingViewOrder = [...savedViewOrder];
        pendingHiddenViewIds = new Set(savedHiddenViewIds);
      }
      updateEditModeUI(request.enable);
      applyCustomLayout(request.enable ? pendingViewOrder : savedViewOrder, request.enable ? pendingHiddenViewIds : savedHiddenViewIds);
    });
    sendResponse({ status: 'edit_toggled', isEditMode: isEditMode });
    return true;
  }

  if (request.action === 'saveChanges') {
    saveChanges();
    sendResponse({ status: 'success' });
    return true;
  }

  if (request.action === 'resetAll') {
    hardResetToDefault();
    sendResponse({ status: 'success' });
    return true;
  }
});

// --- AUTOMATION & ALERT MONITORING ENGINE ---
let autoRefreshTimer = null;
let lastTicketCount = -1;
let originalFaviconUrl = null;
let faviconFlashInterval = null;
let isRedState = false;

function isExtensionValid() {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime && chrome.runtime.id);
}

function getMyOpenTicketsCount() {
  const targetNode = document.querySelector('li[data-zvm-id="node-my-open-tickets"]') ||
                     document.querySelector('li[data-zvm-id="node-my-tickets"]') ||
                     document.querySelector('nav[aria-label="Views"] li[type="node"]');

  if (!targetNode) return 0;

  const countEl = targetNode.querySelector('[data-test-id="views_views-list_item_count"]');

  if (countEl && countEl.textContent.trim()) {
    const parsed = parseInt(countEl.textContent.trim(), 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function getOriginalFaviconUrl() {
  if (originalFaviconUrl) return originalFaviconUrl;
  const link = document.querySelector('link[rel*="icon"]');
  if (link) {
    originalFaviconUrl = link.href;
    return originalFaviconUrl;
  }
  return '/favicon.ico';
}

function createRedDotFavicon(callback) {
  const origUrl = getOriginalFaviconUrl();
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = origUrl;

  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(img, 0, 0, 32, 32);

    const radius = 6;
    const x = 32 - radius - 1;
    const y = radius + 1;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = '#EF4444';
    ctx.fill();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    callback(canvas.toDataURL('image/png'));
  };
}

function updateFaviconFlash(count, showBadge) {
  const link = document.querySelector('link[rel*="icon"]') || document.createElement('link');
  if (!link.parentNode) {
    link.rel = 'shortcut icon';
    document.head.appendChild(link);
  }

  const origUrl = getOriginalFaviconUrl();

  if (!showBadge || count <= 0) {
    if (faviconFlashInterval) {
      clearInterval(faviconFlashInterval);
      faviconFlashInterval = null;
    }
    link.href = origUrl;
    isRedState = false;
    return;
  }

  if (!faviconFlashInterval) {
    createRedDotFavicon((redDotDataUrl) => {
      faviconFlashInterval = setInterval(() => {
        isRedState = !isRedState;
        link.href = isRedState ? redDotDataUrl : origUrl;
      }, 700);
    });
  }
}

function processTicketAutomation() {
  if (!isExtensionValid()) {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    if (faviconFlashInterval) clearInterval(faviconFlashInterval);
    return;
  }

  chrome.storage.local.get(['autoRefreshEnabled', 'badgeEnabled', 'soundEnabled'], (settings) => {
    if (!isExtensionValid() || chrome.runtime.lastError) return;

    if (settings.autoRefreshEnabled && !isDragging) {
      const refreshBtn = document.querySelector('[data-test-id="views_views-list_header-refresh"]');
      if (refreshBtn) {
        refreshBtn.click();
      }
    }

    setTimeout(() => {
      if (!isExtensionValid()) return;

      const currentCount = getMyOpenTicketsCount();
      const showBadge = Boolean(settings.badgeEnabled);

      updateFaviconFlash(currentCount, showBadge);

      if (settings.soundEnabled && lastTicketCount !== -1 && currentCount > lastTicketCount) {
        playSelectedSound();
      }

      lastTicketCount = currentCount;
    }, 1800);
  });
}

function syncAutomationTimer() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }

  if (!isExtensionValid()) return;

  processTicketAutomation();

  chrome.storage.local.get(['autoRefreshEnabled', 'autoRefreshVal', 'autoRefreshUnit'], (settings) => {
    if (!isExtensionValid() || chrome.runtime.lastError || !settings.autoRefreshEnabled) return;

    const val = settings.autoRefreshVal || 1;
    const unit = settings.autoRefreshUnit || 'minutes';

    let delayMs = val * (unit === 'minutes' ? 60000 : 1000);
    if (delayMs < 15000) delayMs = 15000;

    autoRefreshTimer = setInterval(processTicketAutomation, delayMs);
  });
}

syncAutomationTimer();

if (isExtensionValid()) {
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.autoRefreshEnabled || changes.autoRefreshVal || changes.autoRefreshUnit || changes.badgeEnabled) {
      syncAutomationTimer();
    }
  });
}