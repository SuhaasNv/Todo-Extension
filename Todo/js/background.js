const MENU_ID = 'add-selection-to-todo';

function newTodoId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `todo-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function updateBadgeFromTodos(todos) {
  const active = (todos || []).filter((t) => !t.completed).length;
  const text =
    active === 0 ? '' : active > 99 ? '99+' : String(active);
  chrome.action.setBadgeText({ text });
  if (active > 0) {
    chrome.action.setBadgeBackgroundColor({ color: '#5C6BC0' });
  }
}

function refreshBadge() {
  chrome.storage.sync.get(['todos'], (result) => {
    updateBadgeFromTodos(result.todos || []);
  });
}

function ensureContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Add selection to To-Do',
      contexts: ['selection'],
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureContextMenu();
  refreshBadge();
});

chrome.runtime.onStartup.addListener(() => {
  refreshBadge();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync' || !changes.todos) return;
  updateBadgeFromTodos(changes.todos.newValue || []);
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== MENU_ID) return;
  const text = (info.selectionText || '').trim().replace(/\s+/g, ' ');
  if (!text) return;
  const clipped = text.length > 2000 ? `${text.slice(0, 1997)}…` : text;

  chrome.storage.sync.get(['todos'], (res) => {
    const todos = Array.isArray(res.todos) ? [...res.todos] : [];
    todos.push({
      id: newTodoId(),
      text: clipped,
      completed: false,
      dueDate: null,
      priority: 1,
    });
    chrome.storage.sync.set({ todos });
  });
});
