/*
Data access for "tasks"
Central place for all SQL statements
Only DB read/write logic
*/

import { getDb } from '../db/db.js';
import { randomUUID } from 'crypto';

const db = getDb();
const ISO = d => new Date(d).toISOString().slice(0, 19) + 'Z'; // normalising to seconds

function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addWeeks(d, n) { return addDays(d, 7 * n); }
function addMonthsSafe(d, n) {
    const base = new Date(d);
    const day = base.getDate();

    // jump to 1st of target month to avoid overflow
    const target = new Date(base);
    target.setDate(1);
    target.setMonth(target.getMonth() + n);

    // days in target month
    const daysInTarget = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();

    // clamp to last day if original day doesn't exist in target month
    target.setDate(Math.min(day, daysInTarget));
    return target;
}

function* recurDates(startISO, untilISO, kind) {
    let cur = new Date(startISO);
    const end = new Date(untilISO);
    while (cur <= end) {
        yield ISO(cur);
        if (kind === 'daily') cur = addDays(cur, 1);
        if (kind === 'weekly') cur = addWeeks(cur, 1);
        if (kind === 'monthly') cur = addMonthsSafe(cur, 1);
    }
}

// CREATE a new task.
export function createTask(body) {
  const now = new Date().toISOString();
  const id = randomUUID();

  const recur = body.recur ?? null;                 // 'daily' | 'weekly' | 'monthly' | null
  const recur_until = body.recur_until ?? null;     // ISO | null
  const series_id = recur ? (body.series_id || randomUUID()) : null;

  // Build the row and apply defaults.
  const row = {
    id,
    title: (body.title || '').trim(),
    status: body.status || 'todo', // default status
    priority: body.priority || 'low', // default priority
    due_at: body.due_at || null,
    user_id: body.user_id, // required for authentication
    created_at: now,
    updated_at: now,
    series_id,
    recur,
    recur_until,
    parent_id: null
  };

  // Insert a new task using parameters.
  db.prepare(`
    INSERT INTO tasks (id, title, status, priority, due_at, user_id, created_at, updated_at, series_id, recur, recur_until, parent_id)
    VALUES (@id, @title, @status, @priority, @due_at, @user_id, @created_at, @updated_at, @series_id, @recur, @recur_until, @parent_id)
  `).run(row);

  if (recur && recur_until && row.due_at) {
      expandRecurrence(row, { horizonDays: 60 });
  }

  return row;
}

// LIST tasks with basic filtering.
export function listTasks({ limit = 20, offset = 0, status, priority, q, userId } = {}) {
  // Collect WHERE clauses & named params.
  const where = [];
  const params = {};

  // Ensure only returning the current user's tasks
  where.push('user_id = @userId');      
  params.userId = userId;

  if (status) {
    where.push('status = @status');
    params.status = status;
  }
  if (priority) {
    where.push('priority = @priority');
    params.priority = priority;
  }
  if (q) {
    // Simple search for title (q can be located anywhere in title NAME).
    where.push('LOWER(title) LIKE LOWER(@q)');
    params.q = `%${q}%`;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // Fetch a page of items (sorted newest first by created_at).
  const items = db.prepare(`
    SELECT * FROM tasks ${whereSql} 
    ORDER BY created_at DESC 
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit, offset });

  // Get total matching count for UI.
  const total = db.prepare(`
    SELECT COUNT(*) as c FROM tasks ${whereSql}
  `).get(params).c;

  return { total, limit, offset, items };
}

// GET a single TASK by ID.
export function getTask(id, userId) {
  return db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, userId);
}

// UPDATE a task by ID.
export function updateTask(id, patch, userId) {
    const now = new Date().toISOString();

    // Ensure ownership.
    const row = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, userId);
    if (!row) return null;

    // prevents ownership/PK tampering.
    const {
        user_id: _ignoreUserId,
        id: _ignoreId,
        created_at: _ignoreCreated,
        updated_at: _ignoreUpdated,
        ...allowedPatch
    } = patch || {};

    const nextSeriesId =
        (allowedPatch.recur && !row.series_id) ? (allowedPatch.series_id || randomUUID()) :
            (allowedPatch.series_id ?? row.series_id);

    // Build the next row using locked id/user_id from DB + allowed fields only.
    const next = {
        ...row,
        ...allowedPatch,
        series_id: nextSeriesId,
        id: row.id,
        user_id: row.user_id,
        updated_at: now
    };

    db.prepare(`
    UPDATE tasks SET 
      title = @title,
      status = @status,
      priority = @priority,
      due_at = @due_at,
      series_id = @series_id,
      recur = @recur,
      recur_until = @recur_until,
      updated_at = @updated_at
    WHERE id = @id AND user_id = @user_id
  `).run(next);

    if (next.recur && next.recur_until && next.due_at) {
        expandRecurrence(next, { horizonDays: 60 });
    }

    return next;
}

// Expands a recurring "template" task into concrete dated instances up to a horizon.
export function expandRecurrence(templateTask, { horizonDays = 60 } = {}) {
    // checks if not a recurring template
    if (!templateTask.recur || !templateTask.recur_until) return 0;
    if (!templateTask.due_at) return 0;

    const now = new Date();
    const horizonEnd = addDays(now, horizonDays);
    const until = new Date(templateTask.recur_until);
    const effectiveUntil = until < horizonEnd ? until : horizonEnd;

    const insert = db.prepare(`
    INSERT INTO tasks (id, title, status, priority, due_at, user_id, created_at, updated_at, series_id, parent_id)
    VALUES (@id, @title, @status, @priority, @due_at, @user_id, @created_at, @updated_at, @series_id, @parent_id)
  `);

    let created = 0;
    // Iterate over each occurrence date (daily/weekly/monthly) between start and effective end
    for (const dueISO of recurDates(templateTask.due_at, effectiveUntil.toISOString(), templateTask.recur)) {
        const sameInstant = new Date(dueISO).getTime() === new Date(templateTask.due_at).getTime();
        if (sameInstant) continue;

        // Prevent duplicates if expand runs more than once
        const exists = db.prepare(
            `SELECT 1 FROM tasks WHERE user_id = ? AND series_id = ? AND due_at = ? LIMIT 1`
        ).get(templateTask.user_id, templateTask.series_id, dueISO);
        if (exists) continue;

        insert.run({
            id: randomUUID(),
            title: templateTask.title,
            status: 'todo',
            priority: templateTask.priority,
            due_at: dueISO,
            user_id: templateTask.user_id,
            created_at: ISO(new Date()),
            updated_at: ISO(new Date()),
            series_id: templateTask.series_id,
            parent_id: templateTask.id
        });
        created++;
    }
    return created;
}

// // Lists tasks whose due_at falls on a specific local calendar day
export function listTasksOnDate(userId, yyyy_mm_dd, { limit = 50, offset = 0 } = {}) {
    const start = new Date(`${yyyy_mm_dd}T00:00:00`);
    const end = new Date(`${yyyy_mm_dd}T23:59:59.999`);
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    const total = db.prepare(
        `SELECT COUNT(*) as c FROM tasks WHERE user_id = ? AND due_at BETWEEN ? AND ?`
    ).get(userId, startISO, endISO).c;

    const items = db.prepare(
        `SELECT * FROM tasks WHERE user_id = ? AND due_at BETWEEN ? AND ?
     ORDER BY due_at ASC, created_at ASC
     LIMIT ? OFFSET ?`
    ).all(userId, startISO, endISO, limit, offset);

    return { total, limit, offset, items };
}

// Deletes tasks belonging to a recurrence series
export function deleteSeriesBySeriesId(seriesId, userId, { onlyFuture = false } = {}) {
    if (onlyFuture) {
        const nowISO = new Date().toISOString();
        const info = db.prepare(
            `DELETE FROM tasks WHERE user_id = ? AND series_id = ? AND due_at >= ?`
        ).run(userId, seriesId, nowISO);
        return info.changes;
    } else {
        const info = db.prepare(
            `DELETE FROM tasks WHERE user_id = ? AND series_id = ?`
        ).run(userId, seriesId);
        return info.changes;
    }
}

// Deletes its whole series by task id
export function deleteSeriesByTaskId(taskId, userId, opts = {}) {
    const row = db.prepare(
        `SELECT series_id FROM tasks WHERE id = ? AND user_id = ?`
    ).get(taskId, userId);
    if (!row || !row.series_id) return 0;
    return deleteSeriesBySeriesId(row.series_id, userId, opts);
}

// DELETE a task by ID.
export function deleteTask(id, userId) {
  const info = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(id, userId);;
  return info.changes > 0; // True if a row was deleted.
}