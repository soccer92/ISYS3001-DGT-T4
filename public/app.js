//Calls local API endpoints under /api/tasks
//Renders a list with "done" + "delete" actions

//GET /api/tasks - list (first page)
async function fetchTasks() {
  const res = await fetch('/api/tasks');
  const data = await res.json(); //API returns (total, limit, offset items)
  return data.items || [];
}

//POST /api/tasks - create
async function addTask(title) {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({title})
  });

if (!res.ok) {
  const err = await res.json().catch(() => ({}));
  alert('Failed to create task: ' + (err?.message || res.status));
  return null;
}
  return res.json();
}

//PATCH /api/tasks/:id - mark as done
async function markDone(id) {
  await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({status:'done'})
  });
}

//DELETE /api/tasks/:id - remove
async function deleteTask(id) {
  await fetch(`/api/tasks/${id}`, {method:'DELETE'});
}

//Render the current list pf tasks to <ul>
function render(tasks) {
  const ul = document.getElementById('task-list');
  ul.innerHTML = (tasks || []).map(t => `
  <li data-id="${t.id}">
    <strong>[${t.priority}]</strong> ${t.title}
      <em>(${t.status})</em>
      <button class="done">done</button>
      <button class="del">delete</button>
    </li>
    `).join('');
}

//Refresh the UI from the API
async function refresh() {
  const tasks = await fetchTasks();
  render(tasks);
}

//Hook up DOM events on load
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

//Delegate clicks for done/delete buttons
list?.addEventListener('click', async (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  const id = li.getAttribute('data-id');

  if (e.target.classList.contains('done')) {
      await markDone(id);
      refresh();
  } else if (e.target.classList.contains('del')) {
    await deleteTask(id);
    refresh();
  }
});

refresh();
});
