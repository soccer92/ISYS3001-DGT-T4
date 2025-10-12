-- Database schema for tasks.
-- Main tasks table.
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,         -- Name of task.
  description TEXT,            -- Optional description.
  status TEXT NOT NULL DEFAULT 'todo'	CHECK (status IN ('todo','in_progress','done')), -- Todo / In-Progress / Done.
  priority TEXT NOT NULL DEFAULT 'low'	CHECK (priority IN ('low','medium','high')),   -- Low / Medium / High.
  due_at TEXT,
  user_id TEXT NOT NULL,                          -- If adding users / logins later become feasible.
  created_at TEXT NOT NULL,                       -- Timestamp set by NODE.
  updated_at TEXT NOT NULL,                       -- Timestamp refreshed upon updating task.
  series_id    TEXT,                              -- Same UUID for all instances in a series.
  recur        TEXT		CHECK (recur IN ('daily','weekly','monthly')), -- NULL if non-recurring.
  recur_until  TEXT,           -- ISO-8601 end date (inclusive) for templates.
  parent_id    TEXT,           -- points to the template task's id for generated instances.
  CHECK (recur IS NULL OR due_at IS NOT NULL)
);

-- Simple indexes for common used filters.
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_title_nocase ON tasks(title COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due   ON tasks(user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_series     ON tasks(series_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_series_due ON tasks(user_id, series_id, due_at);

-- Users table.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  created_at TEXT NOT NULL
);

-- Simple indexes for common used filters.
CREATE INDEX IF NOT EXISTS idx_users_email on users(email);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);