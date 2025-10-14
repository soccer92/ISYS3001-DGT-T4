// Script to migrate description option into the db, without losing old content
import { getDb } from './db.js';

const db = getDb();

function hasColumn(table, col) {
    const rows = db.prepare(`PRAGMA table_info(${table});`).all();
    return rows.some(r => r.name === col);
}

db.exec('BEGIN');
try {
    if (!hasColumn('tasks', 'description')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN description TEXT`);
        console.log('Added column: tasks.description');
    } else {
        console.log('Column already exists: tasks.description');
    }
    db.exec('COMMIT');
} catch (e) {
    db.exec('ROLLBACK');
    console.error('Migration failed:', e);
    process.exit(1);
}