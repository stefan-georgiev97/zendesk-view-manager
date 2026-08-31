# Zendesk View Manager (ZVM) v1.0.0

A lightweight, high-performance Chrome Extension designed to customize, reorder, and declutter ticket views directly inside Zendesk Agent Workspace.

Built with a native **NitroPack-inspired UI**, ZVM introduces drag-and-drop view reordering and granular view visibility toggles without disrupting Zendesk's core styling.

---

## 🚀 Key Features

* **Drag-and-Drop Reordering**: Intuitively reorder root views, folders, and nested child queues using smooth, aligned grip handles (`⋮⋮ |`).
* **Instant View Visibility Toggle**: Hide noisy or unused views using crisp, vector eye icons. Hidden views fade into a draft preview mode while editing and vanish when saved.
* **On-Page Floating Control Toolbar**: Edit Mode auto-closes the popup and launches an unobtrusive floating bar directly on your Zendesk workspace (`Save`, `Reset`, `Exit`).
* **Auto-Resizing Workspace**: Dynamically expands the Zendesk sidebar grid width in Edit Mode so view titles never clip or truncate.
* **Observer Mutation Shield**: Built with a strict DOM MutationObserver lock pattern to eliminate infinite re-render loops and browser CPU spikes.
* **NitroPack Design System**: Features NitroPack's signature deep dark purple (`#120040`), electric purple (`#6C38FF`), and mint green (`#00D28A`) color scheme with centered, pill-shaped controls.

---

## 📦 Installation & Setup

1. Download a ZIP of the repository
2. Open Google Chrome and navigate to chrome://extensions/.
3. Enable Developer mode via the toggle switch in the top-right corner.
4. Click Load unpacked and select your zendesk-view-manager directory.
5. Refresh your active Zendesk Agent Workspace tab.

---

## 🎯 How to Use

1. Click the Zendesk View Manager extension icon in your Chrome toolbar to open the popup interface.
2. Click Enable Edit Mode—the popup automatically collapses and launches the floating toolbar directly on your Zendesk workspace.
3. Reorder Views: Drag any view or folder by grabbing its far-left grip handle (⋮⋮ |).
4. Hide Views: Click the eye icon (👁️ / 👁️‍🗨️) on the right edge of any item row to switch its draft visibility.
5. Click 💾 Save on the floating on-page toolbar to commit changes, or click ↺ Reset to instantly revert back to default layout.