// Ensures the users table exist in the current DB.
// Run once via: npm run db:migrate:users

import { getDb } from './db.js';

const db = getDb();

db.exec(`
  PRAGMA foreign_keys=ON;

  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,               -- UUID (string)
    email TEXT NOT NULL UNIQUE,        -- login identifier (unique, lowercased)
    password_hash TEXT NOT NULL,       -- scrypt hash hex
    password_salt TEXT NOT NULL,       -- salt used for scrypt
    first_name TEXT NOT NULL,          -- given name
    last_name TEXT NOT NULL,           -- family name
    phone TEXT,                        -- optional
    created_at TEXT NOT NULL           -- ISO timestamp
  );

  -- Simple indexes for common used filters
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
`);

console.log('Users table & indexes initialised.');
