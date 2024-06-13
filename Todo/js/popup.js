document.addEventListener('DOMContentLoaded', function() {
    const todoForm = document.getElementById('todo-form');
    const todoInput = document.getElementById('todo-input');
    const todoList = document.getElementById('todo-list');
  
    // Load todos from storage
    chrome.storage.sync.get(['todos'], function(result) {
      const todos = result.todos || [];
      todos.forEach(addTodoToDOM);
    });
  
    // Add a new todo
    todoForm.addEventListener('submit', function(event) {
      event.preventDefault();
      const todoText = todoInput.value.trim();
      if (todoText === '') return;
  
      const todo = { text: todoText, completed: false };
      addTodoToDOM(todo);
  
      // Save to storage
      chrome.storage.sync.get(['todos'], function(result) {
        const todos = result.todos || [];
        todos.push(todo);
        chrome.storage.sync.set({ todos: todos });
      });
  
      todoInput.value = '';
    });
  
    // Add a todo item to the DOM
    function addTodoToDOM(todo) {
      const li = document.createElement('li');
      
      const span = document.createElement('span');
      span.textContent = todo.text;
      li.appendChild(span);
  
      if (todo.completed) {
        li.classList.add('completed');
      }
  
      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'Delete';
      deleteButton.classList.add('delete');
      deleteButton.addEventListener('click', function() {
        li.remove();
        // Update storage
        chrome.storage.sync.get(['todos'], function(result) {
          const todos = result.todos.filter(t => t.text !== todo.text);
          chrome.storage.sync.set({ todos: todos });
        });
      });
  
      li.appendChild(deleteButton);
      todoList.appendChild(li);
  
      // Mark as completed
      span.addEventListener('click', function() {
        li.classList.toggle('completed');
        // Update storage
        chrome.storage.sync.get(['todos'], function(result) {
          const todos = result.todos.map(t => {
            if (t.text === todo.text) {
              t.completed = !t.completed;
            }
            return t;
          });
          chrome.storage.sync.set({ todos: todos });
        });
      });
    }
  });
  