document.addEventListener('DOMContentLoaded', () => {
  const newId = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `todo-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  const PRIORITY_NORMAL = 1;

  let todos = [];
  let filter = 'all';
  let editingId = null;
  let searchQuery = '';
  let sortMode = 'manual';
  let themePref = 'system';
  let undoState = null;

  const todoForm = document.getElementById('todo-form');
  const todoInput = document.getElementById('todo-input');
  const todoSearch = document.getElementById('todo-search');
  const todoList = document.getElementById('todo-list');
  const emptyState = document.getElementById('empty-state');
  const clearCompletedBtn = document.getElementById('clear-completed');
  const sortModeSelect = document.getElementById('sort-mode');
  const themeToggle = document.getElementById('theme-toggle');
  const exportBtn = document.getElementById('export-todos');
  const importInput = document.getElementById('import-todos');
  const undoBar = document.getElementById('undo-bar');
  const undoDeleteBtn = document.getElementById('undo-delete');

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function migrateTodos(raw) {
    const arr = Array.isArray(raw) ? raw : [];
    let changed = false;
    const next = arr.map((t) => {
      if (!t) {
        changed = true;
        return {
          id: newId(),
          text: '',
          completed: false,
          dueDate: null,
          priority: PRIORITY_NORMAL,
        };
      }
      if (!t.id) changed = true;
      const id = t.id || newId();
      const text = String(t.text || '');
      const completed = !!t.completed;
      const rawDue = t.dueDate;
      const dueDate =
        rawDue && /^\d{4}-\d{2}-\d{2}$/.test(String(rawDue)) ? String(rawDue) : null;
      if (rawDue != null && String(rawDue) !== '' && dueDate === null) changed = true;
      const priority = [0, 1, 2].includes(t.priority) ? t.priority : PRIORITY_NORMAL;
      if (![0, 1, 2].includes(t.priority)) changed = true;
      return { id, text, completed, dueDate, priority };
    });
    return { todos: next, changed };
  }

  function filterByTab(list) {
    if (filter === 'active') return list.filter((t) => !t.completed);
    if (filter === 'completed') return list.filter((t) => t.completed);
    return list;
  }

  function matchesSearch(t) {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return t.text.toLowerCase().includes(q);
  }

  function sortVisible(list) {
    if (sortMode === 'due') {
      return [...list].sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        return a.text.localeCompare(b.text);
      });
    }
    if (sortMode === 'priority') {
      return [...list].sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate)
          return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        return a.text.localeCompare(b.text);
      });
    }
    return list;
  }

  function visibleTodos() {
    const tabbed = filterByTab(todos);
    const searched = tabbed.filter(matchesSearch);
    return sortVisible(searched);
  }

  function saveTodos() {
    chrome.storage.sync.set({ todos });
  }

  function savePreferences() {
    chrome.storage.sync.set({ theme: themePref, sortMode });
  }

  function effectiveTheme() {
    if (themePref === 'light') return 'light';
    if (themePref === 'dark') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', effectiveTheme());
    const labels = { system: 'Auto', light: 'Light', dark: 'Dark' };
    themeToggle.textContent = labels[themePref] || 'Auto';
    themeToggle.title = `Theme: ${themePref} (click to cycle)`;
  }

  function cycleTheme() {
    const order = ['system', 'light', 'dark'];
    const i = order.indexOf(themePref);
    themePref = order[(i + 1) % order.length];
    savePreferences();
    applyTheme();
  }

  function updateEmptyState() {
    const visible = visibleTodos();
    if (visible.length > 0) {
      emptyState.hidden = true;
      return;
    }
    emptyState.hidden = false;
    const q = searchQuery.trim();
    if (q && todos.length > 0) {
      emptyState.textContent = 'No tasks match your search.';
      return;
    }
    if (todos.length === 0) {
      emptyState.textContent = 'No tasks yet. Add one above.';
    } else if (filter === 'active') {
      emptyState.textContent = 'No active tasks.';
    } else if (filter === 'completed') {
      emptyState.textContent = 'No completed tasks.';
    } else {
      emptyState.textContent = 'No tasks.';
    }
  }

  function clearUndoTimer() {
    if (undoState && undoState.timeoutId) {
      clearTimeout(undoState.timeoutId);
    }
  }

  function hideUndo() {
    clearUndoTimer();
    undoState = null;
    undoBar.hidden = true;
  }

  function showUndo(removed, index) {
    clearUndoTimer();
    undoState = {
      todo: removed,
      index: Math.min(Math.max(0, index), todos.length),
      timeoutId: setTimeout(hideUndo, 5000),
    };
    undoBar.hidden = false;
  }

  function setFilter(next) {
    finishEditIfAny();
    filter = next;
    document.querySelectorAll('.filter-btn').forEach((btn) => {
      const on = btn.dataset.filter === next;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    render();
  }

  function finishEditIfAny() {
    const input = todoList.querySelector('li.todo-item.editing input.todo-edit-input');
    if (input) commitEdit(input);
  }

  function commitEdit(input) {
    if (!input.isConnected) return;
    const li = input.closest('li');
    if (!li) return;
    const id = li.dataset.todoId;
    if (editingId !== id) return;

    const text = input.value.trim();
    editingId = null;

    if (text === '') {
      todos = todos.filter((t) => t.id !== id);
      saveTodos();
      render();
      return;
    }

    todos = todos.map((t) => (t.id === id ? { ...t, text } : t));
    saveTodos();
    render();
  }

  function cancelEdit() {
    editingId = null;
    render();
  }

  function startEdit(id) {
    if (editingId && editingId !== id) finishEditIfAny();
    editingId = id;
    render();
    const li = todoList.querySelector(`li[data-todo-id="${CSS.escape(id)}"]`);
    if (!li) return;
    li.classList.add('editing');
    const input = li.querySelector('input.todo-edit-input');
    if (input) {
      input.focus();
      input.select();
    }
  }

  function reorderTodos(fromId, toId) {
    if (fromId === toId) return;
    const fromIdx = todos.findIndex((t) => t.id === fromId);
    const toIdx = todos.findIndex((t) => t.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...todos];
    const [item] = next.splice(fromIdx, 1);
    const insertAt = next.findIndex((t) => t.id === toId);
    next.splice(insertAt, 0, item);
    todos = next;
    saveTodos();
    render();
  }

  function moveTodoToLast(fromId) {
    const idx = todos.findIndex((t) => t.id === fromId);
    if (idx < 0) return;
    const [item] = todos.splice(idx, 1);
    todos.push(item);
    saveTodos();
    render();
  }

  function priorityLabel(p) {
    if (p === 0) return 'Low';
    if (p === 2) return 'High';
    return 'Norm';
  }

  function cyclePriority(id) {
    todos = todos.map((t) => {
      if (t.id !== id) return t;
      const next = ((t.priority ?? PRIORITY_NORMAL) + 1) % 3;
      return { ...t, priority: next };
    });
    saveTodos();
    render();
  }

  function setDueDate(id, value) {
    const dueDate = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
    todos = todos.map((t) => (t.id === id ? { ...t, dueDate } : t));
    saveTodos();
    render();
  }

  function render() {
    todoList.innerHTML = '';
    const visible = visibleTodos();
    const dragEnabled = sortMode === 'manual';
    const today = todayISO();

    visible.forEach((todo) => {
      const li = document.createElement('li');
      li.className = 'todo-item';
      li.dataset.todoId = todo.id;
      if (todo.completed) li.classList.add('completed');
      if (todo.dueDate && !todo.completed && todo.dueDate < today) li.classList.add('overdue');

      if (dragEnabled && editingId !== todo.id) {
        const handle = document.createElement('span');
        handle.className = 'drag-handle';
        handle.draggable = true;
        handle.title = 'Drag to reorder';
        handle.setAttribute('aria-hidden', 'true');
        handle.textContent = '⋮⋮';
        handle.addEventListener('dragstart', (e) => {
          e.stopPropagation();
          e.dataTransfer.setData('text/plain', todo.id);
          e.dataTransfer.effectAllowed = 'move';
          li.classList.add('dragging');
        });
        handle.addEventListener('dragend', () => li.classList.remove('dragging'));
        li.appendChild(handle);

        li.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        });
        li.addEventListener('drop', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const fromId = e.dataTransfer.getData('text/plain');
          reorderTodos(fromId, todo.id);
        });
      } else {
        const spacer = document.createElement('span');
        spacer.className = 'drag-spacer';
        spacer.setAttribute('aria-hidden', 'true');
        li.appendChild(spacer);
      }

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'todo-done';
      checkbox.checked = todo.completed;
      checkbox.setAttribute('aria-label', todo.completed ? 'Mark incomplete' : 'Mark complete');
      checkbox.addEventListener('change', () => {
        todos = todos.map((t) =>
          t.id === todo.id ? { ...t, completed: checkbox.checked } : t
        );
        saveTodos();
        render();
      });

      const main = document.createElement('div');
      main.className = 'todo-main';

      if (editingId === todo.id) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'todo-edit-input';
        input.value = todo.text;
        input.setAttribute('aria-label', 'Edit task');
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitEdit(input);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
          }
        });
        input.addEventListener('blur', () => {
          if (editingId === todo.id) commitEdit(input);
        });
        main.appendChild(input);
      } else {
        const span = document.createElement('span');
        span.className = 'todo-text';
        span.textContent = todo.text;
        span.title = 'Double-click to edit';
        span.addEventListener('dblclick', (e) => {
          e.preventDefault();
          startEdit(todo.id);
        });
        main.appendChild(span);

        const dueInput = document.createElement('input');
        dueInput.type = 'date';
        dueInput.className = 'todo-due';
        dueInput.value = todo.dueDate || '';
        dueInput.title = 'Due date';
        dueInput.setAttribute('aria-label', 'Due date');
        dueInput.addEventListener('change', () => setDueDate(todo.id, dueInput.value));
        dueInput.addEventListener('click', (e) => e.stopPropagation());
        main.appendChild(dueInput);
      }

      const prioBtn = document.createElement('button');
      prioBtn.type = 'button';
      prioBtn.className = 'priority-btn';
      prioBtn.classList.add(`priority-${todo.priority ?? PRIORITY_NORMAL}`);
      prioBtn.textContent = priorityLabel(todo.priority ?? PRIORITY_NORMAL);
      prioBtn.title = 'Cycle priority (Low / Normal / High)';
      prioBtn.addEventListener('click', () => cyclePriority(todo.id));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'delete';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => {
        if (editingId === todo.id) editingId = null;
        const idx = todos.findIndex((t) => t.id === todo.id);
        const removed = todos[idx];
        todos = todos.filter((t) => t.id !== todo.id);
        saveTodos();
        hideUndo();
        showUndo(removed, idx);
        render();
      });

      li.appendChild(checkbox);
      li.appendChild(main);
      li.appendChild(prioBtn);
      li.appendChild(deleteBtn);
      todoList.appendChild(li);
    });

    if (dragEnabled && editingId === null && visible.length > 0) {
      const zone = document.createElement('li');
      zone.className = 'todo-drop-zone';
      zone.textContent = 'Drop to move to end';
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        const fromId = e.dataTransfer.getData('text/plain');
        moveTodoToLast(fromId);
      });
      todoList.appendChild(zone);
    }

    updateEmptyState();

    const hasCompleted = todos.some((t) => t.completed);
    clearCompletedBtn.disabled = !hasCompleted;
  }

  function loadStorage() {
    chrome.storage.sync.get(['todos', 'theme', 'sortMode'], (result) => {
      const { todos: migrated, changed } = migrateTodos(result.todos);
      todos = migrated;
      if (changed) saveTodos();

      if (result.theme === 'light' || result.theme === 'dark' || result.theme === 'system') {
        themePref = result.theme;
      }
      if (result.sortMode === 'due' || result.sortMode === 'priority' || result.sortMode === 'manual') {
        sortMode = result.sortMode;
        sortModeSelect.value = sortMode;
      }

      applyTheme();
      render();
      todoInput.focus();
    });
  }

  loadStorage();

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (themePref === 'system') applyTheme();
  });

  todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    finishEditIfAny();
    hideUndo();
    const text = todoInput.value.trim();
    if (!text) return;
    todos.push({
      id: newId(),
      text,
      completed: false,
      dueDate: null,
      priority: PRIORITY_NORMAL,
    });
    saveTodos();
    todoInput.value = '';
    render();
    todoInput.focus();
  });

  todoSearch.addEventListener('input', () => {
    searchQuery = todoSearch.value;
    render();
  });

  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter));
  });

  sortModeSelect.addEventListener('change', () => {
    finishEditIfAny();
    sortMode = sortModeSelect.value;
    savePreferences();
    render();
  });

  themeToggle.addEventListener('click', () => cycleTheme());

  clearCompletedBtn.addEventListener('click', () => {
    finishEditIfAny();
    hideUndo();
    if (!todos.some((t) => t.completed)) return;
    if (!confirm('Remove all completed tasks?')) return;
    todos = todos.filter((t) => !t.completed);
    saveTodos();
    render();
  });

  exportBtn.addEventListener('click', () => {
    const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), todos }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const day = todayISO();
    a.href = url;
    a.download = `todos-${day}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  importInput.addEventListener('change', () => {
    const file = importInput.files && importInput.files[0];
    importInput.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || '{}'));
        const rawList = Array.isArray(data) ? data : data.todos;
        if (!Array.isArray(rawList)) {
          alert('Invalid file: expected a JSON array or { "todos": [...] }.');
          return;
        }
        if (!confirm('Replace all current tasks with the imported list?')) return;

        const seenIds = new Set();
        const imported = rawList.map((item) => {
          let id = item && item.id ? String(item.id) : newId();
          if (seenIds.has(id)) id = newId();
          seenIds.add(id);
          const text = item && item.text != null ? String(item.text) : '';
          const completed = !!(item && item.completed);
          const dueDate =
            item && item.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(String(item.dueDate))
              ? String(item.dueDate)
              : null;
          const priority = [0, 1, 2].includes(item && item.priority) ? item.priority : PRIORITY_NORMAL;
          return { id, text, completed, dueDate, priority };
        });

        todos = imported;
        saveTodos();
        hideUndo();
        render();
      } catch {
        alert('Could not read JSON. Check the file format.');
      }
    };
    reader.readAsText(file);
  });

  undoDeleteBtn.addEventListener('click', () => {
    if (!undoState) return;
    clearUndoTimer();
    const { todo, index } = undoState;
    undoState = null;
    undoBar.hidden = true;
    const at = Math.min(index, todos.length);
    todos.splice(at, 0, todo);
    saveTodos();
    render();
  });
});
