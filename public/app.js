/*
* Calls local API endpoints under /api/tasks.
* Renders a list with "done" and "delete" actions.
*/

// Auth helper.
async function me() {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return null;
    return res.json();
}

// Fetch wrapper that bounces to login on 401.
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

// Added if the team later wanted to show which user is logged in.
function setUserHeader(user) {
    const el = document.getElementById('userBox');
    if (!el) return;
    const label = user.firstName ? `${user.firstName} ${user.lastName || ''} � ${user.email}` : user.email;
    el.textContent = label.trim();
}

// GET /api/tasks (List Tasks on Homepage).
async function fetchTasks() {
  const res = await apiFetch('/api/tasks');
  const data = await res.json(); // API returns (total, limit, offset, items).
  return data.items || [];
}

// Helper to set any status.
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
    body: JSON.stringify({
      title,
      description: 'Quick-added task',
      status: 'todo',
      priority: 'low',
      // due_at: null
    })
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

  const confirmDelete = confirm("Are you sure you want to delete this task? This action cannot be undone.");
  if (!confirmDelete) return;

  try {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
    alert('Task deleted successfully!');

    document.getElementById('edit-form').style.display = 'none';
    if (typeof refreshEdit === 'function') refreshEdit(); // Refresh if available.
    else if (typeof refresh === 'function') refresh();    // Fallback for homepage.

  } catch (err) {
    console.error(err);
    alert('Failed to delete task: ' + err.message);
  }
}

// Escape special HTML characters so user input is displayed safely.
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Render the current list of tasks to <ul>.
function render(tasks) {

  const isViewPage = window.location.pathname.includes('view-task.html'); // Includes edit btn on view task page only.

  const ul = document.getElementById('task-list');
  if (!ul) return; // Skips rendering on pages without a task list (for updateCompletionStatus() to work).

  // Map values to display labels.
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
      // Conditional progress button
      let progressBtn = '';
      if (t.status === 'todo') {
        progressBtn = `<button type="button" class="to-in-progress">In Progress</button>`;
      } else if (t.status === 'in_progress') {
        progressBtn = `<button type="button" class="to-done">Done</button>`;
      }

      const pr = priorityLabels[t.priority] || t.priority;
      const st = statusLabels[t.status] || t.status;

      const dd = t.due_at
        ? new Date(t.due_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
        : '';

      return `        
      <li data-id="${t.id}" data-priority="${t.priority}">
        <strong>${escapeHtml(pr)}</strong> 
        ${escapeHtml(t.title)}
        <em>${escapeHtml(st)}</em>
        ${t.due_at ? `<p><b>Due:</b> ${dd}</p>` : ''}
        ${t.recur ? `<p class="recur-info">Repeats ${t.recur} until ${t.recur_until ? new Date(t.recur_until).toLocaleDateString('en-AU') : '—'}</p>` : ''}
        <div class="task-actions">
          ${progressBtn}
          ${isViewPage ? `<button type="button" class="edit">Edit</button>` : ''}
          ${isViewPage ? `<button type="button" class="del">Delete</button>` : ''}
        </div>
      </li>`;
    })
    .join('');
}

// GET /api/tasks/:id (fetch a single task by ID).
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

// Update the completion status in the footer.
async function updateCompletionStatus(tasks) {
  try {
    const tasks = await fetchTasks(); // Fetch all tasks from API.
    const completed = tasks.filter(t => t.status === 'done').length; // Count completed tasks.
    const percent = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0; // Calculates percentage.

    document.getElementById('completion-status').textContent = `${percent}%`;

  } catch (err) {
    console.error('Failed to update completion status', err);
    document.getElementById('completion-status').textContent = 'Error';
  }
}

// Hook up DOM events on load.
window.addEventListener('DOMContentLoaded', async () => {
    // Auth gate.
    const user = await me();
    if (!user) {
        window.location.href = '/login.html';
        return;
    }
    setUserHeader(user); // For future use.

    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }

    // Export tasks as PDF/CSV functionality.
    const exportTasksCSV = document.getElementById('exportCSV');
    const exportTasksPDF = document.getElementById('exportPDF');

    if (exportTasksCSV) {
        console.log('Export CSV initialised');
        exportTasksCSV.addEventListener('click', async (e) => {
            e.preventDefault();
            window.open('/api/tasks/export/csv', '_blank');
        });
    }
    
    if (exportTasksPDF) {
      exportTasksPDF.addEventListener('click', async (e) => {
          e.preventDefault();
          window.open('/api/tasks/export/pdf', '_blank');
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

  let currentFormParent = null;

  // Delegate clicks for done/delete buttons.
  list?.addEventListener('click', async (e) => {


    const li = e.target.closest('li');
    if (!li) return;
    const id = li.getAttribute('data-id');

    // Handle progression states.
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

        const editForm = document.getElementById('edit-form');

        if (!editForm) {
          console.warn('No edit form on this page.');
          return; // Do nothing on pages without the edit form.
        }

        // Fetch the task details from the API.
        const task = await fetchTaskById(id);

        const due = task.due_at || '';

        // Populate the task editing form with API values.
        document.getElementById('edit-task-id').value = task.id;
        document.getElementById('edit-task-title').value = task.title || '';
        document.getElementById('edit-task-desc').value = task.description || '';
        document.getElementById('edit-task-priority').value = task.priority || 'medium';
        document.getElementById('edit-date').value = task.due_at || '';
        document.getElementById('edit-task-recurr').value = task.recur || 'none';
        document.getElementById('edit-task-recurr-until').value = task.recur_until || '';
        document.getElementById('edit-date').value = due ? String(due).slice(0, 10) : '';
        document.getElementById('edit-task-status').value = task.status || 'todo';

        // Move form below the selected task.
        if (currentFormParent && currentFormParent !== li) {
          currentFormParent.classList.remove('editing');
        }
        currentFormParent = li;
        li.after(editForm);
        editForm.style.display = 'block';
        li.classList.add('editing');

        editForm.scrollIntoView({ behavior: 'smooth', block: 'center' }); // Smooth scroll to form.

      }
      // Await refresh();
    } catch (err) {
      console.error(err);
      alert('Action failed: ' + (err?.message || 'See console'));
    }
  });

  // Handle the Create Task form (create-task.html)
  const createForm = document.querySelector('.task-create');

  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.querySelector('#task-title').value.trim();
      const description = document.querySelector('#task-description').value.trim();
      const dueDate = document.querySelector('#due-date').value;
      const priority = document.querySelector('#task-priority').value;
      const recurr = document.querySelector('#recurr').value !== 'none' ? document.querySelector('#recurr').value : null;
      const recurrUntil = document.querySelector('#recurr-until').value || null;

      const dueISO = dueDate ? new Date(dueDate).toISOString() : null; // Normalise to ISO or null.

      if (!title || !description || !dueDate) {
        alert('Please fill in all required fields.');
        return;
      }

      const newTask = {
        title,
        description,
        due_at: dueISO,
        priority,
        recur: recurr !== 'none' ? recurr : null,
        recur_until: recurrUntil ? new Date(recurrUntil).toISOString() : null
      };

      try {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTask)
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error('Validation errors:', JSON.stringify(err, null, 2));
          alert('Failed to create task: ' + (err?.message || res.status));
          return;
        }

        alert('Task created successfully!');
        createForm.reset();
        window.location.href = '/'; // Redirect to homepage after creation.
      } catch (err) {
        console.error('Error creating task:', err);
        alert('Error connecting to server. Please try again later.');
      }
    });
  }
  // Initial refresh on page load.
  refresh();
});