// Migrate recurring option into the db, without losing old content

import { getDb } from './db.js';

const db = getDb();

// Helper to check if the data exists already
function hasColumn(table, col) {
    const rows = db.prepare(`PRAGMA table_info(${table});`).all();
    return rows.some(r => r.name === col);
}

db.exec('BEGIN');

try {
    if (!hasColumn('tasks', 'series_id')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN series_id TEXT`); // same UUID for a recurrence set
    }
    if (!hasColumn('tasks', 'recur')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN recur TEXT`);     // null | 'daily' | 'weekly' | 'monthly' (adds options for recurring)
    }
    if (!hasColumn('tasks', 'recur_until')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN recur_until TEXT`); // ISO end-date (last date for the recurrence)
    }
    if (!hasColumn('tasks', 'parent_id')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN parent_id TEXT`); // each generated id will point back to the main task id
    }

    // Fast filters
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks(due_at)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON tasks(user_id, due_at)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_series ON tasks(series_id)`);

    db.exec('COMMIT');
    console.log('Recurring migration complete.');
} catch (e) {
    db.exec('ROLLBACK');
    console.error('Migration failed:', e);
    process.exit(1);
}

console.log('Task table & indexes udated, for recurring.');