// Data access for users (create/verify/fetch).

import { getDb } from '../db/db.js';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

function hashPassword(password, saltHex) {
    const salt = Buffer.from(saltHex, 'hex');
    const hash = scryptSync(password, salt, 64);
    return hash.toString('hex');
}

// internal: includes password fields
function getInternalByEmail(email) {
    const db = getDb();
    return (
        db.prepare(
            `SELECT id, email, password_hash, password_salt,
              first_name, last_name, phone, created_at
       FROM users WHERE email = ?`
        ).get(email.toLowerCase()) || null
    );
}

// Export for findUserByEmail
export function findUserByEmail(email) {
    const row = getInternalByEmail(email);
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

// Create a user account. Validates email uniqueness and returns safe profile fields.
export function createUser({ email, password, firstName, lastName, phone }) {
    const db = getDb();

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
    const row = getInternalByEmail(email);
    if (!row) return null;

    const calc = hashPassword(password, row.password_salt);
    const ok = timingSafeEqual(Buffer.from(calc, 'hex'), Buffer.from(row.password_hash, 'hex'));
    if (!ok) return null;

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
    const db = getDb();
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

