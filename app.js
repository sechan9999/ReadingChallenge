/**
 * Daily Todo Manager
 * 개인용 할 일 관리 앱
 */

(function() {
  'use strict';

  // ===== 상수 =====
  const STORAGE_KEY = 'dailyTodoManager_todos';
  const CATEGORIES = {
    work: { label: '💼 업무', emoji: '💼' },
    personal: { label: '🏠 개인', emoji: '🏠' },
    study: { label: '📚 공부', emoji: '📚' }
  };

  // ===== 상태 =====
  let todos = [];
  let currentFilter = 'all';
  let editingId = null;

  // ===== DOM 요소 =====
  const todoInput = document.getElementById('todo-input');
  const categorySelect = document.getElementById('category-select');
  const addBtn = document.getElementById('add-btn');
  const todoList = document.getElementById('todo-list');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const clearCompletedBtn = document.getElementById('clear-completed-btn');

  // ===== 초기화 =====
  function init() {
    loadTodos();
    renderTodos();
    setupEventListeners();
  }

  // ===== LocalStorage =====
  function loadTodos() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      todos = stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('데이터 로드 실패:', e);
      todos = [];
    }
  }

  function saveTodos() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch (e) {
      console.error('데이터 저장 실패:', e);
    }
  }

  // ===== CRUD 기능 =====
  
  /**
   * 새 할 일 추가
   */
  function addTodo() {
    const title = todoInput.value.trim();
    if (!title) {
      todoInput.focus();
      return;
    }

    const newTodo = {
      id: crypto.randomUUID(),
      title: title,
      category: categorySelect.value,
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null
    };

    todos.unshift(newTodo); // 최신 항목을 위에 표시
    saveTodos();
    renderTodos();

    // 입력 필드 초기화
    todoInput.value = '';
    todoInput.focus();
  }

  /**
   * 할 일 삭제
   */
  function deleteTodo(id) {
    todos = todos.filter(todo => todo.id !== id);
    saveTodos();
    renderTodos();
  }

  /**
   * 완료 상태 토글
   */
  function toggleComplete(id) {
    const todo = todos.find(t => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
      todo.completedAt = todo.completed ? new Date().toISOString() : null;
      saveTodos();
      renderTodos();
    }
  }

  /**
   * 할 일 제목 수정
   */
  function updateTodo(id, newTitle) {
    const todo = todos.find(t => t.id === id);
    if (todo && newTitle.trim()) {
      todo.title = newTitle.trim();
      saveTodos();
    }
    editingId = null;
    renderTodos();
  }

  /**
   * 완료된 항목 모두 삭제
   */
  function clearCompleted() {
    const completedCount = todos.filter(t => t.completed).length;
    if (completedCount === 0) return;
    
    todos = todos.filter(todo => !todo.completed);
    saveTodos();
    renderTodos();
  }

  // ===== 필터링 =====
  function setFilter(filter) {
    currentFilter = filter;
    
    // 활성 버튼 스타일 업데이트
    filterBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    
    renderTodos();
  }

  function getFilteredTodos() {
    if (currentFilter === 'all') {
      return todos;
    }
    return todos.filter(todo => todo.category === currentFilter);
  }

  // ===== 진행률 =====
  function updateProgress() {
    const filtered = getFilteredTodos();
    const total = filtered.length;
    const completed = filtered.filter(t => t.completed).length;

    if (total === 0) {
      progressFill.style.width = '0%';
      progressText.textContent = '할 일을 추가하세요';
      return;
    }

    const percent = Math.round((completed / total) * 100);
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `${completed} / ${total} 완료 (${percent}%)`;
  }

  // ===== 렌더링 =====
  function renderTodos() {
    const filtered = getFilteredTodos();

    // 빈 상태 처리
    if (filtered.length === 0) {
      const message = todos.length === 0 
        ? '할 일이 없습니다. 새로운 할 일을 추가해보세요!'
        : '이 카테고리에 할 일이 없습니다.';
      
      todoList.innerHTML = `<li class="empty-state">${message}</li>`;
      updateProgress();
      return;
    }

    // 할 일 목록 렌더링
    todoList.innerHTML = filtered.map(todo => {
      const isEditing = editingId === todo.id;
      
      return `
        <li class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
          <input 
            type="checkbox" 
            class="todo-checkbox" 
            ${todo.completed ? 'checked' : ''}
            aria-label="완료 체크"
          >
          <span class="todo-category ${todo.category}">
            ${CATEGORIES[todo.category].emoji}
          </span>
          ${isEditing 
            ? `<input 
                type="text" 
                class="todo-edit-input" 
                value="${escapeHtml(todo.title)}"
                maxlength="100"
              >`
            : `<span class="todo-title">${escapeHtml(todo.title)}</span>`
          }
          <div class="todo-actions">
            <button class="edit-btn" aria-label="수정">✏️</button>
            <button class="delete-btn" aria-label="삭제">🗑️</button>
          </div>
        </li>
      `;
    }).join('');

    // 수정 모드일 때 포커스
    if (editingId) {
      const editInput = todoList.querySelector('.todo-edit-input');
      if (editInput) {
        editInput.focus();
        editInput.select();
      }
    }

    updateProgress();
  }

  // ===== 유틸리티 =====
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ===== 이벤트 리스너 =====
  function setupEventListeners() {
    // 추가 버튼 클릭
    addBtn.addEventListener('click', addTodo);

    // Enter 키로 추가
    todoInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addTodo();
      }
    });

    // 필터 버튼 클릭
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        setFilter(btn.dataset.filter);
      });
    });

    // 완료 항목 삭제 버튼
    clearCompletedBtn.addEventListener('click', clearCompleted);

    // 할 일 목록 이벤트 위임
    todoList.addEventListener('click', (e) => {
      const todoItem = e.target.closest('.todo-item');
      if (!todoItem) return;

      const id = todoItem.dataset.id;

      // 체크박스 클릭
      if (e.target.classList.contains('todo-checkbox')) {
        toggleComplete(id);
        return;
      }

      // 삭제 버튼 클릭
      if (e.target.classList.contains('delete-btn')) {
        deleteTodo(id);
        return;
      }

      // 수정 버튼 클릭
      if (e.target.classList.contains('edit-btn')) {
        editingId = id;
        renderTodos();
        return;
      }
    });

    // 더블클릭으로 수정 모드
    todoList.addEventListener('dblclick', (e) => {
      if (e.target.classList.contains('todo-title')) {
        const todoItem = e.target.closest('.todo-item');
        if (todoItem) {
          editingId = todoItem.dataset.id;
          renderTodos();
        }
      }
    });

    // 수정 입력 이벤트 (Enter, Esc)
    todoList.addEventListener('keydown', (e) => {
      if (!e.target.classList.contains('todo-edit-input')) return;

      const todoItem = e.target.closest('.todo-item');
      const id = todoItem.dataset.id;

      if (e.key === 'Enter') {
        updateTodo(id, e.target.value);
      } else if (e.key === 'Escape') {
        editingId = null;
        renderTodos();
      }
    });

    // 수정 입력 포커스 아웃 시 저장
    todoList.addEventListener('focusout', (e) => {
      if (e.target.classList.contains('todo-edit-input')) {
        const todoItem = e.target.closest('.todo-item');
        if (todoItem && editingId) {
          updateTodo(todoItem.dataset.id, e.target.value);
        }
      }
    });
  }

  // ===== 앱 시작 =====
  document.addEventListener('DOMContentLoaded', init);

})();
