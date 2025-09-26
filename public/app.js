// Calls local API endpoints under /api/tasks.
// Renders a list with "done" and "delete" actions.

// GET /api/tasks (List Tasks on Homepage).
async function fetchTasks() {
  const res = await fetch('/api/tasks');
  const data = await res.json(); // API returns (total, limit, offset, items).
  return data.items || [];
}

// Helper to set any status
async function updateStatus(id, status) {
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error(`Update failed (${res.status})`);
  return res.json();
}

// POST /api/tasks (Create Task).
async function addTask(title) {
  const res = await fetch('/api/tasks', {
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
  const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
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
  const ul = document.getElementById('task-list');

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
          <button type="button" class="del">Delete</button>
        </div>
      </li>`;
    })
    .join('');
}

// Refresh the UI from the API.
async function refresh() {
  const tasks = await fetchTasks();
  render(tasks);
}

// Hook up DOM events on load.
window.addEventListener('DOMContentLoaded', () => {
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
      }
    } catch (err) {
      console.error(err);
      alert('Action failed: ' + (err?.message || 'See console'));
    }
  });

  refresh();
});
