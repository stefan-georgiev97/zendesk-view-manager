console.log('[ZVM] Content script active.');

let savedHiddenViewIds = new Set();
let pendingHiddenViewIds = new Set();
let savedViewOrder = [];
let pendingViewOrder = [];

let isEditMode = false;
let isDragging = false;
let defaultOriginalOrder = [];
let dropIndicator = null;

// SVG Icons (Clean Vector Open Eye vs Slashed Eye)
const SVG_EYE_OPEN = `<svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;
const SVG_EYE_SLASH = `<svg viewBox="0 0 24 24"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.44-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.17c0-1.66-1.34-3-3-3l-.17.02z"/></svg>`;

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

function updateEditModeUI(enable) {
  isEditMode = enable;
  document.body.classList.toggle('zvm-edit-mode', enable);

  const items = document.querySelectorAll('li.sc-cb7c8b8b-0');

  items.forEach((li) => {
    let dragHandle = li.querySelector('.zvm-page-drag-handle');
    let eyeBtn = li.querySelector('.zvm-eye-toggle-btn');
    const innerLink = li.querySelector('a');
    const viewId = li.dataset.zvmId;

    if (enable) {
      if (!li.classList.contains('zvm-draggable')) {
        li.classList.add('zvm-draggable');
        li.draggable = true;
      }

      if (innerLink && innerLink.getAttribute('draggable') !== 'false') {
        innerLink.setAttribute('draggable', 'false');
      }

      // Inject Drag Handle
      if (!dragHandle) {
        dragHandle = document.createElement('span');
        dragHandle.className = 'zvm-page-drag-handle';
        dragHandle.textContent = '⋮⋮';
        li.insertBefore(dragHandle, li.firstChild);
      }

      // Inject Eye Toggle Button
      if (!eyeBtn && viewId) {
        eyeBtn = document.createElement('button');
        eyeBtn.className = 'zvm-eye-toggle-btn';
        
        const isHiddenInDraft = pendingHiddenViewIds.has(viewId);
        eyeBtn.innerHTML = isHiddenInDraft ? SVG_EYE_SLASH : SVG_EYE_OPEN;
        eyeBtn.title = isHiddenInDraft ? "Click to unhide view" : "Click to hide view";

        if (isHiddenInDraft) {
          li.classList.add('zvm-draft-hidden');
        }

        eyeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();

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

        const targetRow = li.querySelector('.sc-1483ae13-0 > a') || li.querySelector('a') || li;
        targetRow.appendChild(eyeBtn);
      }

      // Drag Listeners
      li.ondragstart = (e) => {
        isDragging = true;
        li.classList.add('zvm-dragging');
        e.dataTransfer.setData('text/plain', li.dataset.zvmId);
        e.dataTransfer.effectAllowed = 'move';
      };

      li.ondragend = () => {
        li.classList.remove('zvm-dragging');
        const indicator = getDropIndicator();
        if (indicator.parentNode) {
          indicator.parentNode.removeChild(indicator);
        }
        updatePendingOrderFromDOM();
        setTimeout(() => { isDragging = false; }, 100);
      };

      li.ondragover = (e) => {
        e.preventDefault();
        const draggingLi = document.querySelector('li.zvm-dragging');
        if (!draggingLi || draggingLi === li) return;

        const bounding = li.getBoundingClientRect();
        const offset = e.clientY - bounding.top - (bounding.height / 2);
        const indicator = getDropIndicator();

        if (offset > 0) {
          li.parentNode.insertBefore(draggingLi, li.nextSibling);
          li.parentNode.insertBefore(indicator, li.nextSibling);
        } else {
          li.parentNode.insertBefore(draggingLi, li);
          li.parentNode.insertBefore(indicator, li);
        }
      };
    } else {
      // Remove Edit Mode Elements
      li.classList.remove('zvm-draggable');
      li.classList.remove('zvm-draft-hidden');
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
  const items = document.querySelectorAll('li.sc-cb7c8b8b-0');
  const currentOrder = [];

  items.forEach((li) => {
    if (li.dataset.zvmId) {
      currentOrder.push(li.dataset.zvmId);
    }
  });

  pendingViewOrder = currentOrder;
  notifyStateChange();
}

function notifyStateChange() {
  const hasOrderChanges = JSON.stringify(pendingViewOrder) !== JSON.stringify(savedViewOrder);
  const hasHideChanges = JSON.stringify(Array.from(pendingHiddenViewIds).sort()) !== JSON.stringify(Array.from(savedHiddenViewIds).sort());

  chrome.runtime.sendMessage({ 
    action: 'stateUpdated', 
    hasUnsavedChanges: hasOrderChanges || hasHideChanges,
    hiddenCount: pendingHiddenViewIds.size
  });
}

function applyCustomLayout(orderToUse = savedViewOrder, hiddenSetToUse = savedHiddenViewIds) {
  if (isDragging) return;

  captureDefaultOrder();
  const itemsMap = new Map();
  const allListItems = document.querySelectorAll('li.sc-cb7c8b8b-0');

  allListItems.forEach((li) => {
    const name = getViewName(li);
    if (!name) return;

    const type = li.getAttribute('type') || (li.className.includes('expanded') ? 'folder' : 'node');
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

// Storage Initialization
chrome.storage.local.get(['hiddenViews', 'viewOrder'], (result) => {
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

chrome.storage.onChanged.addListener((changes) => {
  if (changes.hiddenViews && !isEditMode) {
    savedHiddenViewIds = new Set(changes.hiddenViews.newValue || []);
    pendingHiddenViewIds = new Set(savedHiddenViewIds);
    applyCustomLayout();
  }
  if (changes.viewOrder && !isEditMode) {
    savedViewOrder = changes.viewOrder.newValue || [];
    pendingViewOrder = [...savedViewOrder];
    applyCustomLayout();
  }
});

const observer = new MutationObserver(() => {
  if (isDragging) return;

  clearTimeout(window.zvmDebounce);
  window.zvmDebounce = setTimeout(() => {
    applyCustomLayout(isEditMode ? pendingViewOrder : savedViewOrder, isEditMode ? pendingHiddenViewIds : savedHiddenViewIds);
    if (isEditMode) updateEditModeUI(true);
  }, 200);
});
observer.observe(document.body, { childList: true, subtree: true });

// Popup Communication Channel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getState') {
    const hasOrderChanges = JSON.stringify(pendingViewOrder) !== JSON.stringify(savedViewOrder);
    const hasHideChanges = JSON.stringify(Array.from(pendingHiddenViewIds).sort()) !== JSON.stringify(Array.from(savedHiddenViewIds).sort());

    sendResponse({ 
      isEditMode: isEditMode,
      hiddenCount: isEditMode ? pendingHiddenViewIds.size : savedHiddenViewIds.size,
      hasUnsavedChanges: hasOrderChanges || hasHideChanges
    });
  }

  if (request.action === 'toggleEditMode') {
    if (!request.enable && JSON.stringify(pendingViewOrder) !== JSON.stringify(savedViewOrder)) {
      pendingViewOrder = [...savedViewOrder];
      pendingHiddenViewIds = new Set(savedHiddenViewIds);
    }
    updateEditModeUI(request.enable);
    applyCustomLayout(request.enable ? pendingViewOrder : savedViewOrder, request.enable ? pendingHiddenViewIds : savedHiddenViewIds);
  }

  if (request.action === 'saveChanges') {
    savedViewOrder = [...pendingViewOrder];
    savedHiddenViewIds = new Set(pendingHiddenViewIds);

    chrome.storage.local.set({ 
      viewOrder: savedViewOrder,
      hiddenViews: Array.from(savedHiddenViewIds)
    }, () => {
      updateEditModeUI(false);
      applyCustomLayout(savedViewOrder, savedHiddenViewIds);
      sendResponse({ status: 'success' });
    });
    return true;
  }

  if (request.action === 'resetAll') {
    savedViewOrder = [];
    pendingViewOrder = [];
    savedHiddenViewIds = new Set();
    pendingHiddenViewIds = new Set();

    chrome.storage.local.remove(['viewOrder', 'hiddenViews'], () => {
      updateEditModeUI(false);
      applyCustomLayout(defaultOriginalOrder, savedHiddenViewIds);
      sendResponse({ status: 'success' });
    });
    return true;
  }
});