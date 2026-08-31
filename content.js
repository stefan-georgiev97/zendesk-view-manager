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

const SVG_EYE_OPEN = `<svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;
const SVG_EYE_SLASH = `<svg viewBox="0 0 24 24"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.44-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.17c0-1.66-1.34-3-3-3l-.17.02z"/></svg>`;

// Helper: Run DOM mutations with the observer temporarily disconnected
function execWithoutObserver(fn) {
  if (observer) observer.disconnect();
  try {
    fn();
  } finally {
    // Flush any pending async mutations before reconnecting
    if (observer) {
      observer.takeRecords();
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }
}

function getViewName(liElement) {
  if (!liElement.className.includes('sc-cb7c8b8b-0')) return null;

  const ariaLabelDiv = liElement.querySelector('[aria-describedby]');
  if (ariaLabelDiv && ariaLabelDiv.textContent.trim()) {
    return ariaLabelDiv.textContent.trim();
  }

  const tooltipDiv = liElement.querySelector('[data-garden-container-id="containers.tooltip"]');
  if (tooltipDiv && tooltipDiv.textContent.trim()) {
    return tooltipDiv.textContent.trim();
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
  const items = document.querySelectorAll('li.sc-cb7c8b8b-0');
  items.forEach((li) => {
    const name = getViewName(li);
    if (!name) return;
    const type = li.getAttribute('type') || (li.className.includes('expanded') ? 'folder' : 'node');
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
  const rowWrapper = li.querySelector('.sc-1483ae13-0') || li;
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
    const indicator = getDropIndicator();
    if (indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
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

  const allItems = document.querySelectorAll('li.sc-cb7c8b8b-0');

  allItems.forEach((li) => {
    const viewId = li.dataset.zvmId;
    const rowWrapper = li.querySelector('.sc-1483ae13-0') || li;
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
              pendingHiddenViewIds.delete(viewId);
              li.classList.remove('zvm-draft-hidden');
              eyeBtn.innerHTML = SVG_EYE_OPEN;
              eyeBtn.title = "Click to hide view";
            } else {
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
  const allItems = document.querySelectorAll('li.sc-cb7c8b8b-0');
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

// Minimal Reset: Only restores default DOM sequence and clears hidden classes
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

function applyCustomLayout(orderToUse = savedViewOrder, hiddenSetToUse = savedHiddenViewIds) {
  captureDefaultOrder();
  const itemsMap = new Map();
  const allListItems = document.querySelectorAll('li.sc-cb7c8b8b-0');

  allListItems.forEach((li) => {
    const name = getViewName(li);
    if (!name) return;

    const type = li.getAttribute('type') || (li.className.includes('expanded') ? 'folder' : 'node');
    const id = `${type}-${slugify(name)}`;
    li.dataset.zvmId = id;

    // Apply visibility class
    if (hiddenSetToUse.has(id)) {
      li.classList.add('zvm-hidden');
    } else {
      li.classList.remove('zvm-hidden');
    }

    itemsMap.set(id, li);
  });

  // Re-append nodes in sequence if necessary
  if (orderToUse && orderToUse.length > 0 && itemsMap.size > 0) {
    orderToUse.forEach((id) => {
      const li = itemsMap.get(id);
      if (li && li.parentNode) {
        li.parentNode.appendChild(li);
      }
    });
  }
}

// Storage Initialization
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
  if (!isEditMode) {
    execWithoutObserver(() => {
      if (changes.hiddenViews) {
        savedHiddenViewIds = new Set(changes.hiddenViews.newValue || []);
        pendingHiddenViewIds = new Set(savedHiddenViewIds);
      }
      if (changes.viewOrder) {
        savedViewOrder = changes.viewOrder.newValue || [];
        pendingViewOrder = [...savedViewOrder];
      }
      applyCustomLayout();
    });
  }
});

// Guarded MutationObserver: Disconnects instantly when triggered to prevent cascades
observer = new MutationObserver(() => {
  if (isDragging) return;

  execWithoutObserver(() => {
    applyCustomLayout(isEditMode ? pendingViewOrder : savedViewOrder, isEditMode ? pendingHiddenViewIds : savedHiddenViewIds);
    if (isEditMode) updateEditModeUI(true);
  });
});

observer.observe(document.body, { childList: true, subtree: true });

// Message Handlers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getState') {
    const hasOrderChanges = JSON.stringify(pendingViewOrder) !== JSON.stringify(savedViewOrder);
    const hasHideChanges = JSON.stringify(Array.from(pendingHiddenViewIds).sort()) !== JSON.stringify(Array.from(savedHiddenViewIds).sort());

    sendResponse({ 
      isEditMode: isEditMode,
      hiddenCount: isEditMode ? pendingHiddenViewIds.size : savedHiddenViewIds.size,
      hasUnsavedChanges: hasOrderChanges || hasHideChanges
    });
    return true; // Keep channel open
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
    return true; // Keep channel open
  }

  if (request.action === 'saveChanges') {
    saveChanges();
    sendResponse({ status: 'success' });
    return true; // Keep channel open
  }

  if (request.action === 'resetAll') {
    resetDraftsKeepEditMode();
    sendResponse({ status: 'success' });
    return true; // Keep channel open
  }
});