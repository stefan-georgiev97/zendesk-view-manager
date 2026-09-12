# Zendesk Support Manager v1.1.0

A lightweight, high-performance Chrome Extension designed to customize, reorder, monitor, and declutter ticket queues directly inside Zendesk Agent Workspace.

Built with a native **NitroPack-inspired UI**, ZVM introduces real-time view auto-refresh, custom tab alert flashing, Zendesk CDN audio notifications, drag-and-drop view reordering, and granular visibility toggles without disrupting Zendesk's core styling.


## 🚀 Key Features

### ⚡ Real-Time Automation & Alerts (New in v1.1.0)
* **Custom Auto-Refresh Engine**: Background views polling with custom interval configuration (seconds or minutes, enforcing a 15s rate-limit guardrail).
* **Flashing Tab Alert**: Canvas-rendered pulsing red notification dot overlaid directly on the Zendesk tab favicon whenever open tickets exist.
* **Native Audio Pings**: Sound notifications triggered on ticket count increases using Zendesk CDN-hosted audio assets.
* **Full-Height Tone Selection Sub-View**: Dedicated configuration sub-view (`⚙️ Tones`) featuring full-row interactive radio triggers and inline (`▶ Test`) audio preview buttons for Zendesk's native sound library.

### 🎨 Workspace & Layout Customization
* **Drag-and-Drop Reordering**: Intuitively reorder root views, folders, and nested child queues using smooth, aligned grip handles (`⋮⋮ |`).
* **Instant View Visibility Toggle**: Hide noisy or unused views using vector eye icons. Hidden views toggle real-time opacity during edit mode and vanish completely upon save.
* **On-Page Floating Control Toolbar**: Edit Mode auto-closes the popup and launches an unobtrusive floating bar directly on your Zendesk workspace (`Save`, `Reset`, `Exit`).
* **NitroPack Design System**: Features NitroPack's signature deep dark purple (`#120040`), electric purple (`#6C38FF`), and rounded pill controls (`border-radius: 16px/50px`) with clear sectional dividers (`VIEW MANAGER` vs `AUTOMATION & ALERTS`).


## 📦 Installation & Setup

1. [Download Zendesk Support Manager ZIP](https://github.com/stefan-georgiev97/zendesk-view-manager/archive/refs/heads/main.zip) and unzip it where you want.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** via the toggle switch in the top-right corner.
4. Click **Load unpacked** and select your `zendesk-view-manager` directory.
5. Refresh your active Zendesk Agent Workspace tab.


## 🎯 How to Use

### View Manager & Reordering
1. Click the Zendesk Support Manager extension icon in your Chrome toolbar.
2. Click **Enable Edit Mode**—the popup collapses and launches the floating toolbar directly on your Zendesk workspace.
3. **Reorder Views**: Drag any view or folder by grabbing its far-left grip handle (`⋮⋮ |`).
4. **Hide/Unhide Views**: Click the eye icon on any item row to switch its draft visibility with instant live-opacity feedback.
5. Click **💾 Save** on the floating toolbar to commit changes, or click **↺ Reset** to revert back to default layout.

### Automation & Sound Alerts
1. **Auto-Refresh**: Toggle **⚡ Auto-Refresh Views** and set your custom interval (e.g. `30 seconds` or `1 minute`).
2. **Flashing Tab Alert**: Toggle **🔴 Flashing Tab Alert** to flash a red notification dot on the browser tab favicon whenever there are open tickets.
3. **Sound Alerts**: Toggle **🔔 Sound on Reopen** and click **⚙️ Tones** to slide into the sub-view where you can preview (`▶ Test`) and choose your preferred alert tone.