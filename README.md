# Creative To-Do List

A **Chrome extension** (Manifest V3) for quick task capture and triage from the toolbar. Tasks sync with your Chrome profile via `chrome.storage.sync`, include stable IDs (so duplicate titles never collide), and ship with filters, themes, export/import, and optional context-menu capture.

**Author:** Suhaas Nv · [suhaasnvs@gmail.com](mailto:suhaasnvs@gmail.com)

## Features

### Core

- Add tasks, mark complete with a checkbox, delete with confirmation-friendly **Undo** (about five seconds after a delete).
- **Edit** task text by double-clicking the title (Enter saves, Escape cancels).
- **All / Active / Done** filters plus **search** that narrows the current filter.
- **Clear completed** with a confirm dialog.

### Organization

- **Due date** per task (`YYYY-MM-DD`) with **overdue** highlighting for incomplete items.
- **Priority** (Low / Normal / High) with a compact cycle control; **sort** by manual order, due date, or priority.
- **Drag-and-drop reorder** when sort mode is **Manual order** (grip handle on each row, plus a drop zone to move to the end).

### Polish and data

- **Theme:** Auto (follows system), Light, or Dark—stored in sync.
- **Export** tasks as JSON (`todos-YYYY-MM-DD.json`); **Import** replaces the list after confirmation (invalid or duplicate IDs in a file are handled safely).
- **Toolbar badge** shows the count of active (incomplete) tasks.
- **Context menu:** select text on any page → right-click → **Add selection to To-Do** (requires the `contextMenus` permission).

## Requirements

- **Google Chrome** (or another Chromium browser that supports Manifest V3 extensions).

## Installation (developer / unpacked)

1. Clone this repository or download it as a ZIP and extract it.

   ```bash
   git clone https://github.com/SuhaasNv/Todo-Extension.git
   cd Todo-Extension
   ```

2. Open Chrome and go to [`chrome://extensions`](chrome://extensions).

3. Turn on **Developer mode** (top right).

4. Click **Load unpacked** and choose **either**:

   - The **repository root** folder (`Todo-Extension`), which contains the root [`manifest.json`](manifest.json) that points at files under `Todo/`, **or**
   - The [`Todo`](Todo) folder only, if you prefer to load the inner [`Todo/manifest.json`](Todo/manifest.json) directly.

5. Pin the extension if you want the icon always visible.

After updates, use **Reload** on the extension card on `chrome://extensions`.

## Project layout

| Path | Role |
|------|------|
| [`manifest.json`](manifest.json) | Root manifest for loading the repo as the extension directory |
| [`Todo/manifest.json`](Todo/manifest.json) | Same app, paths relative to `Todo/` (for loading `Todo/` alone) |
| [`Todo/popup.html`](Todo/popup.html) | Popup UI |
| [`Todo/js/popup.js`](Todo/js/popup.js) | Popup logic, storage, rendering |
| [`Todo/js/background.js`](Todo/js/background.js) | Badge updates and context menu |
| [`Todo/css/styles.css`](Todo/css/styles.css) | Styles (light/dark variables) |
| [`Todo/images/`](Todo/images/) | Toolbar icons |

## Usage tips

- Use **search** together with **Active** to focus on what is still open.
- **Import** always **replaces** the entire list; export a backup first if you are unsure.
- **Undo** applies only to the last delete while the popup stays open.
- Long text selected for **Add selection to To-Do** is truncated for storage safety (very long clips are trimmed).

## Privacy

- Tasks and UI preferences are stored in **Chrome’s extension storage** (`chrome.storage.sync` where used). There is no custom backend and no analytics in this project.

## Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a branch (`git checkout -b feature/your-improvement`).
3. Commit focused changes with clear messages.
4. Push and open a Pull Request.

## License

This project is licensed under the [MIT License](LICENSE).
