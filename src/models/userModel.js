// Data access for users (create/verify/fetch).

import { getDb } from '../db/db.js';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const db = getDb();
const exists = await findUserByEmail(db, email);
const user = await createUser(db, { email, password, firstName, lastName });

function hashPassword(password, saltHex) {
    const salt = Buffer.from(saltHex, 'hex');
    const hash = scryptSync(password, salt, 64);1
    return hash.toString('hex');
}

// Create a user account. Validates email uniqueness and returns safe profile fields.
export function createUser({ email, password, firstName, lastName, phone }) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) throw new Error('Email already in use');

    const id = randomUUID();                    // generate user id
    const saltHex = randomBytes(16).toString('hex');  // 128-bit salt
    const password_hash = hashPassword(password, saltHex);
    const now = new Date().toISOString();

    // Store user
    db.prepare(`
    INSERT INTO users (id, email, password_hash, password_salt, first_name, last_name, phone, created_at)
    VALUES (@id, @email, @password_hash, @password_salt, @first_name, @last_name, @phone, @created_at)
  `).run({
        id,
        email: email.toLowerCase(),
        password_hash,
        password_salt: saltHex,
        first_name: firstName,
        last_name: lastName,
        phone: phone ?? null,
        created_at: now
    });

    return { id, email: email.toLowerCase(), firstName, lastName, phone, created_at: now };
}

// Verify credentials. Returns the user profile (no secrets) if password matches.
export function verifyUser(email, password) {
    const row = db.prepare(`
    SELECT id, email, password_hash, password_salt, first_name, last_name, phone, created_at
    FROM users WHERE email = ?
  `).get(email.toLowerCase());

    if (!row) return null;

    const calc = hashPassword(password, row.password_salt);

    // Use constant-time comparison to avoid timing attacks
    const ok = timingSafeEqual(Buffer.from(calc, 'hex'), Buffer.from(row.password_hash, 'hex'));
    if (!ok) return null;

    // Auth OK: return safe profile
    return {
        id: row.id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        phone: row.phone,
        created_at: row.created_at
    };
}

// Fetch by id. Returns safe profile, or null if not found.
export function getUserById(id) {
    const row = db.prepare(`
    SELECT id, email, first_name, last_name, phone, created_at
    FROM users WHERE id = ?
  `).get(id);
    if (!row) return null;
    return {
        id: row.id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        phone: row.phone,
        created_at: row.created_at
    };
}

