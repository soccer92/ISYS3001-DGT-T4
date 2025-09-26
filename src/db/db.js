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
import {fileURLToPath} from 'url';

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