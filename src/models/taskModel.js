/*
Data access for "tasks"
Central place for all SQL statements
Only DB read/write logic
*/

import {getDb} from '../db/db.js';
import {randomUUID} from 'crypto';

const db = getDb();

//CREATE a new task
export function createTask(body) {
  const now = new Date().toISOString();
  const id = randomUUID();

  //Build the row and apply defaults
  const row = {
    id,
    title: (body.title || '').trim(),
    status: body.status || 'todo',  //default status
    priority: body.priority || 'low',  //default priority
    due_at: body.due_at || null,
    user_id: body.user_id || null,  //will be used later if find time to add users
    created_at: now,
    updated_at: now
  };

  //Insert a new task using parameters
db.prepare(`
  INSERT INTO tasks (id,title,status,priority,due_at,user_id,created_at,updated_at) 
  VALUES (@id,@title,@status,@priority,@due_at,@user_id,@created_at,@updated_at)
`).run(row);
return row;
}

//LIST tasks with basic filtering
export function listTasks({limit=20, offset=0, status, priority, q} = {}) {
  //Collect WHERE clauses & named params
  const where = [];
  const params = {};

  if (status) {
    where.push('status = @status'); 
    params.status = status;
  }
  if (priority) {
    where.push('priority = @priority');
    params.priority = priority;
  }
  if (q) {
    //Simple search for title (q can be located anywhere in title NAME)
    where.push('LOWER(title) LIKE LOWER(@q)');
    params.q = `%${q}%`;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  //Fetch a page of items (sorted newest first by created_at)
  const items = db.prepare(
    `SELECT * FROM tasks ${whereSql} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`
    ).all({...params, limit, offset});

//Get total matching count for UI
const total = db.prepare(`SELECT COUNT(*) as c FROM tasks ${whereSql}`).get(params).c;

return {total, limit, offset, items};
}

//GET a single TASK by ID
export function getTask(id) {
  return. db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
}

//UPDATE a task
export function updateTask(id, patch) {
  const cur = getTask(id);
  if (!cur) return null;

  //Merge old row with updated fields (might add groups later)
  const next = {
    ...cur,
    ...patch,
    title: patch.title !== undefined ? String(patch.title).trim() : cur.title,
    updated_at: new Date().toISOString()
  };

//Persist merge record
db.prepare(`
  UPDATE tasks SET
  title=@title, status=@status, priority=@priority, due_at=@due_at, user_id=@user_id, updated_at=@updated_at
  WHERE id=@id
  `).run(next);

  return next;
}

//DELETE a task by ID
export function deleteTask(id) {
  const info = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return info.changes > 0; //true if a row was deleted
}
  
