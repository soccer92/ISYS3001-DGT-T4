-- Database schema for tasks

-- Main tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,                  -- Name of task
  status TEXT NOT NULL DEFAULT 'todo', -- todo / in_progress / done
  priority TEXT NOT NULL DEFAULT 'low', -- low / medium / high
  due_at TEXT,
  user_id TEXT,                          -- if adding users / logins later become feasible
  created_at TEXT NOT NULL,              -- timestamp set by NODE
  updated_at TEXT NOT NULL               -- timestamp refreshed upon updating task
);

-- Simple indexes for common used filters
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_title ON tasks(title);

-- Users table
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

-- Simple indexes for common used filters
CREATE INDEX IF NOT EXISTS idx_users_email on users(email);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);