console.log('Zendesk View Manager MV3 Loaded.');

// Simple initial check to confirm injection on Zendesk
function init() {
  const treeContainer = document.querySelector('[data-test-id="views_views_tree_container"]');
  if (treeContainer) {
    console.log('Zendesk View Tree Container detected:', treeContainer);
  }
}

// Run initial detection
init();