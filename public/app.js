// Calls local API endpoints under /api/tasks.
// Renders a list with "done" and "delete" actions.

// Auth Helper
async function me() {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return null;
    return res.json();
}

// fetch wrapper that bounces to login on 401
async function apiFetch(url, options = {}) {
    const res = await fetch(url, options);
    if (res.status === 401) {
        window.location.href = '/login.html';
        throw new Error('Unauthorised');
    }
    return res;
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => { });
    window.location.href = '/login.html';
}

// Added if later wanted to show user who is logged in
function setUserHeader(user) {
    const el = document.getElementById('userBox');
    if (!el) return;
    const label = user.firstName ? `${user.firstName} ${user.lastName || ''} · ${user.email}` : user.email;
    el.textContent = label.trim();
}

// GET /api/tasks (List Tasks on Homepage).
async function fetchTasks() {
  const res = await apiFetch('/api/tasks');
  const data = await res.json(); // API returns (total, limit, offset, items).
  return data.items || [];
}

// Helper to set any status
async function updateStatus(id, status) {
  const res = await apiFetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error(`Update failed (${res.status})`);
  return res.json();
}

// POST /api/tasks (Create Task).
async function addTask(title) {
  const res = await apiFetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, status: 'todo' })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    alert('Failed to create task: ' + (err?.message || res.status));
    return null;
  }
  return res.json();
}

// PATCH /api/tasks/:id (Mark Task as Done).
async function markDone(id) {
  return updateStatus(id, 'done');
}

// DELETE /api/tasks/:id (Remove Task).
async function deleteTask(id) {
  const res = await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
}

// Escape special HTML characters so user input is displayed safely
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Render the current list of tasks to <ul>.
function render(tasks) {

  const isViewPage = window.location.pathname.includes('view-task.html'); // includes edit btn on view task page only

  const ul = document.getElementById('task-list');
  if (!ul) return; // skips rendering on pages without a task list (for updateCompletionStatus() to work).

  // Map values to display labels
  const priorityLabels = {
    high: "High Priority",
    medium: "Medium Priority",
    low: "Low Priority"
  };

  const statusLabels = {
    todo: "To Do",
    in_progress: "In Progress",
    done: "Completed"
  };

  ul.innerHTML = (tasks || [])
    .map(t => {
      //conditional progress button
      let progressBtn = '';
      if (t.status === 'todo') {
        progressBtn = `<button type="button" class="to-in-progress">In Progress</button>`;
      } else if (t.status === 'in_progress') {
        progressBtn = `<button type="button" class="to-done">Done</button>`;
      }

      const pr = priorityLabels[t.priority] || t.priority;
      const st = statusLabels[t.status] || t.status;

      return `        
      <li data-id="${t.id}" data-priority="${t.priority}">
        <strong>${escapeHtml(pr)}</strong> 
        ${escapeHtml(t.title)}
        <em>${escapeHtml(st)}</em>
        <div class="task-actions">
          ${progressBtn}
          ${isViewPage ? `<button type="button" class="edit">Edit</button>` : ''}
          <button type="button" class="del">Delete</button>
        </div>
      </li>`;
    })
    .join('');
}

// GET /api/tasks/:id (fetch a single task by ID)
async function fetchTaskById(id) {
  const res = await apiFetch(`/api/tasks/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch task (${res.status})`);
  return res.json();
}

// Refresh the UI from the API.
async function refresh() {
  const tasks = await fetchTasks();
  render(tasks);
  updateCompletionStatus(tasks);
}

// Update the completion status in the footer 
function updateCompletionStatus(tasks) {
  try {
    const tasks = await fetchTasks(); // fetch all tasks from API
    const completed = tasks.filter(t => t.status === 'done').length; // count completed tasks
    const percent = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0; // calculates percentage

    document.getElementById('completion-status').textContent = `${percent}%`;

  } catch (err) {
    console.error('Failed to update completion status', err);
    document.getElementById('completion-status').textContent = 'Error';
  }
}

// Hook up DOM events on load.
window.addEventListener('DOMContentLoaded', async () => {
    // Auth Gate
    const user = await me();
    if (!user) {
        window.location.href = '/login.html';
        return;
    }
    setUserHeader(user); // For future use

    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }

  const form = document.getElementById('task-form');
  const input = document.getElementById('task-input');
  const list = document.getElementById('task-list');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = input.value.trim();
    if (!title) return;
    await addTask(title);
    input.value = '';
    refresh();
  });

  // Delegate clicks for done/delete buttons.
  list?.addEventListener('click', async (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    const id = li.getAttribute('data-id');

    // Handle progression states
    try {
      if (e.target.classList.contains('to-in-progress')) {
        await updateStatus(id, 'in_progress');
        await refresh();
      } else if (e.target.classList.contains('to-done')) {
        await updateStatus(id, 'done');
        await refresh();
      } else if (e.target.classList.contains('del')) {
        await deleteTask(id);
        await refresh();
      } else if (e.target.classList.contains('edit')) {

        // Fetch the task details from the API
        const task = await fetchTaskById(id);

        const due = task.due_at || '';

        // Populate the task editing form with API values
        document.getElementById('edit-task-id').value = task.id;
        document.getElementById('edit-task-title').value = task.title || '';
        document.getElementById('edit-task-desc').value = task.description || '';
        document.getElementById('edit-task-priority').value = task.priority || 'medium';
        document.getElementById('edit-date').value = due ? String(due).slice(0, 10) : '';
        document.getElementById('edit-task-status').value = task.status || 'todo';

        document.getElementById('edit-form').style.display = 'block';

      }
    } catch (err) {
      console.error(err);
      alert('Action failed: ' + (err?.message || 'See console'));
    }
  });

  refresh();
});
