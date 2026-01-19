/**
 * Daily Todo Manager
 * Core Application Logic
 */
(() => {
    'use strict';

    // =========================================
    // Constants & DOM Elements
    // =========================================
    const STORAGE_KEY = 'dailyTodoManager_todos';

    const DOM = {
        todoInput: document.getElementById('todo-input'),
        categorySelect: document.getElementById('category-select'),
        addBtn: document.getElementById('add-btn'),
        todoList: document.getElementById('todo-list'),
        clearCompletedBtn: document.getElementById('clear-completed-btn'),
        filterBtns: document.querySelectorAll('.filter-btn'),
        // Progress Elements
        progressBarFill: document.getElementById('progress-bar'), // The fill element
        progressInfo: document.querySelector('.progress-info'),   // Container for text
        dateDisplay: document.getElementById('date-display')
    };

    // =========================================
    // State Management
    // =========================================
    let state = {
        todos: [],
        filter: 'all' // 'all' | 'business' | 'personal' | 'study'
    };

    // =========================================
    // Initialization
    // =========================================
    function init() {
        console.log('Initializing Todo Manager...');
        loadTodos();
        setDate();
        setupEventListeners();
        render();
    }

    /**
     * Sets the current date in human-readable format
     */
    function setDate() {
        const now = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        if (DOM.dateDisplay) {
            DOM.dateDisplay.textContent = now.toLocaleDateString('ko-KR', options);
        }
    }

    // =========================================
    // Persistence (LocalStorage)
    // =========================================
    function saveTodos() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state.todos));
        } catch (e) {
            console.error('Save failed:', e);
            alert('저장 공간이 부족합니다.');
        }
    }

    function loadTodos() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            state.todos = data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Load failed:', e);
            state.todos = [];
        }
    }

    // =========================================
    // Core Logic (CRUD)
    // =========================================

    /**
     * Adds a new todo item
     */
    function addTodo() {
        const title = DOM.todoInput.value.trim();
        const category = DOM.categorySelect.value;

        if (!title) {
            alert('할 일을 입력하세요.');
            DOM.todoInput.focus();
            return;
        }

        const newTodo = {
            id: crypto.randomUUID(),
            title: title,
            category: category,
            completed: false,
            createdAt: new Date().toISOString()
        };

        state.todos.unshift(newTodo);
        saveTodos();
        render();

        DOM.todoInput.value = '';
        DOM.todoInput.focus();
    }

    /**
     * Deletes a todo item by ID
     * @param {string} id 
     */
    function deleteTodo(id) {
        if (confirm('정말 삭제하시겠습니까?')) {
            state.todos = state.todos.filter(t => t.id !== id);
            saveTodos();
            render();
        }
    }

    /**
     * Toggles the completion status of a todo
     * @param {string} id 
     */
    function toggleComplete(id) {
        const todo = state.todos.find(t => t.id === id);
        if (todo) {
            todo.completed = !todo.completed;
            saveTodos();
            render();
        }
    }

    /**
     * Clears all completed items
     */
    function clearCompleted() {
        const completedCount = state.todos.filter(t => t.completed).length;
        if (completedCount === 0) {
            alert('완료된 항목이 없습니다.');
            return;
        }

        if (confirm(`완료된 항목 ${completedCount}개를 모두 삭제하시겠습니까?`)) {
            state.todos = state.todos.filter(t => !t.completed);
            saveTodos();
            render();
        }
    }

    // =========================================
    // Rendering & UI
    // =========================================

    /**
     * Updates the progress bar based on CURRENT FILTER
     * @param {Array} currentTodos - The filtered list of todos
     */
    function updateProgress(currentTodos) {
        const total = currentTodos.length;
        const completed = currentTodos.filter(t => t.completed).length;

        let percent = 0;
        let message = '';

        if (total === 0) {
            percent = 0;
            // Message varies if global list is empty vs filter is empty
            if (state.todos.length === 0) {
                message = '할 일을 추가해보세요!';
            } else {
                message = '이 카테고리엔 할 일이 없네요.';
            }
        } else {
            percent = Math.round((completed / total) * 100);
            message = `${completed} / ${total} 완료 (${percent}%)`;
        }

        // Update styling
        if (DOM.progressBarFill) {
            DOM.progressBarFill.style.width = `${percent}%`;
            // Accessibility
            DOM.progressBarFill.setAttribute('aria-valuenow', percent);
            DOM.progressBarFill.setAttribute('aria-valuemin', '0');
            DOM.progressBarFill.setAttribute('aria-valuemax', '100');
        }

        // Update Text: We assume specific structure in HTML
        // Re-creating the inner HTML of progress-info to match requested format
        // Structure: <span id="progress-text">...</span> <span id="progress-percentage">...</span>
        // But user asked for specific "5 / 12 완료 (42%)" format.
        // Let's just update the text content cleanly.
        if (DOM.progressInfo) {
            DOM.progressInfo.innerHTML = `
                <span style="font-weight:600; color:#4B5563;">${message}</span>
            `;
        }
    }

    function getCategoryLabel(cat) {
        const map = {
            'business': '🏢 업무',
            'personal': '🏠 개인',
            'study': '📚 공부'
        };
        return map[cat] || cat;
    }

    /**
     * Main Render Function
     */
    function render() {
        // 1. Filter
        let filteredTodos = state.todos;
        if (state.filter !== 'all') {
            filteredTodos = state.todos.filter(t => t.category === state.filter);
        }

        // 2. Update Progress (Based on Filtered List)
        updateProgress(filteredTodos);

        // 3. Clear List
        DOM.todoList.innerHTML = '';

        // 4. Render Items
        if (filteredTodos.length === 0) {
            renderEmptyState();
        } else {
            filteredTodos.forEach(todo => {
                const li = document.createElement('li');
                li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
                li.dataset.id = todo.id;

                // Accessibility: Role listitem is default for li, but internal interactives need roles
                li.innerHTML = `
                    <div class="todo-content">
                        <div class="check-circle" 
                             role="checkbox" 
                             aria-checked="${todo.completed}" 
                             tabindex="0"
                             aria-label="${todo.completed ? 'Mark as incomplete' : 'Mark as complete'}">
                            ${todo.completed ? '<i class="fas fa-check"></i>' : ''}
                        </div>
                        <div class="todo-text-wrapper">
                            <span class="todo-text">${escapeHtml(todo.title)}</span>
                            <span class="category-badge badge-${todo.category}">
                                ${getCategoryLabel(todo.category)}
                            </span>
                        </div>
                    </div>
                    <button class="delete-btn" aria-label="Delete ${escapeHtml(todo.title)}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                `;

                DOM.todoList.appendChild(li);
            });
        }

        // 5. Update Filter Buttons
        DOM.filterBtns.forEach(btn => {
            const isActive = btn.dataset.filter === state.filter;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive);
        });
    }

    function renderEmptyState() {
        let msg = '';
        if (state.todos.length === 0) {
            msg = '할 일이 없습니다. 새로운 할 일을 추가해보세요!';
        } else {
            msg = '이 카테고리에는 할 일이 없습니다.';
        }

        DOM.todoList.innerHTML = `
            <li class="empty-message" style="
                text-align: center; 
                padding: 3rem 1rem; 
                color: #9CA3AF; 
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                gap: 10px;">
                <i class="fas fa-clipboard-list" style="font-size: 2rem; opacity: 0.5;"></i>
                <span>${msg}</span>
            </li>
        `;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // =========================================
    // Event Listeners
    // =========================================
    function setupEventListeners() {
        // Add
        DOM.addBtn.addEventListener('click', addTodo);
        DOM.todoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addTodo();
        });

        // Clear
        DOM.clearCompletedBtn.addEventListener('click', clearCompleted);

        // Filter
        DOM.filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                state.filter = btn.dataset.filter;
                render();
            });
        });

        // List Delegation
        DOM.todoList.addEventListener('click', handleListClick);
        DOM.todoList.addEventListener('keydown', handleListKeydown);
    }

    function handleListClick(e) {
        const li = e.target.closest('.todo-item');
        if (!li) return;
        const id = li.dataset.id;

        // Delete
        if (e.target.closest('.delete-btn')) {
            deleteTodo(id);
            return;
        }

        // Toggle (Check circle or Text)
        if (e.target.closest('.check-circle') || e.target.closest('.todo-text-wrapper')) {
            toggleComplete(id);
        }
    }

    function handleListKeydown(e) {
        const checkbox = e.target.closest('.check-circle');
        if (checkbox && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            const li = checkbox.closest('.todo-item');
            if (li) toggleComplete(li.dataset.id);
        }
    }

    // Run
    // Check if DOM is already ready (for hot reload cases) or wait
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
