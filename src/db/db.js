/*
SQLite connection helper + CLI init/seed
Reads .env to locate DB_PATH
Creates parent folder if required
Exposes getDB() for queries
Provides CLI: --init and --seed
*/

import 'dotenv/config'; // Loads enviroment variables from .env file
import Database from 'better-sqlite3'; 
import fs from 'fs'
import path from 'path';
import { fileURLToPath } from 'url';
import { createUser, findUserByEmail } from '../models/userModel.js';

// Finds where this file is located in directory.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve the DB path:
// If DB_PATH is absolute, use it as is.
// If DB_PATH is relative, resolve from project root.
const DB_PATH = process.env.DB_PATH
  ? (path.isAbsolute(process.env.DB_PATH)
      ? process.env.DB_PATH
      : path.join(process.cwd(), process.env.DB_PATH))
  : path.join(process.cwd(), '.localdb', 'tasks.sqlite');

export function getDb() {
  // Ensures the DB directory exists.
  fs.mkdirSync(path.dirname(DB_PATH), {recursive: true});
  // Open the DB.
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  return db;
}

// CLI helpers.
// Create usage for npm run db:init/seed, to create table via schema.sql and insert sample rows via seed.sql.

if (process.argv.includes('--init')) {
  const db = getDb();
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
  console.log('DB initialised at ', DB_PATH);
}

if (process.argv.includes('--seed')) {
  const db = getDb();
  const seedPath = path.join(__dirname, 'seed.sql');
  const seedSql = fs.readFileSync(seedPath, 'utf8');
  db.exec(seedSql);
  console.log('DB seeded with sample data.');
}

if (process.argv.includes('--user')) {
    const uidx = process.argv.indexOf('--user'); 
    const email = process.argv[uidx + 1] || 'test@gmail.com';
    const password = process.argv[uidx + 2] || 'Password123!';

    const firstName = 'Test';
    const lastName = 'User';

    (async () => {
        try {
            const exists = await findUserByEmail(email);
            if (exists) {
                console.log(`User already exists: ${email}`);
                process.exit(0);
            }
            const user = await createUser({ email, password, firstName, lastName });
            console.log('Created user:', { id: user.id, email: user.email });
            process.exit(0);
        } catch (e) {
            console.error('Failed to seed user:', e);
            process.exit(1);
        }
    })();
}