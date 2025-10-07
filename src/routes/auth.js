// Authentication routes: register, login, logout, and "me" endpoint.
import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { createUser, verifyUser, getUserById } from '../models/userModel.js';
import { signAuthCookie, clearAuthCookie, requireAuth } from '../middleware/auth.js';

const router = Router();

// Helper: send 400 with validation errors if any exist.
function check(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
}

/*
POST /api/auth/register
- Validates input
- Creates a new user(will throw if email taken)
*/
router.post(
    '/register',
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 8 }).withMessage('Min 8 chars'),
    body('firstName').isString().trim().isLength({ min: 1 }),
    body('lastName').isString().trim().isLength({ min: 1 }),
    body('phone').optional().isString().trim(),
    (req, res) => {
        const v = check(req, res);
        if (v) return v;

        try {
            // createUser handles hashing + persistence
            const user = createUser(req.body);
            signAuthCookie(res, { id: user.id, email: user.email });

            return res.status(201).json(user);
        } catch (e) {
            if (String(e.message).includes('Email already in use')) {
                return res.status(409).json({ message: 'Email already in use' });
            }
            return res.status(500).json({ message: 'Failed to create user' });
        }
    }
);

/* 
POST /api/auth/login
- Validates input
- Verifies email/password
*/
router.post(
    '/login',
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 1 }),
    (req, res) => {
        const v = check(req, res);
        if (v) return v;

        // verifyUser returns the user if password matches, or null/undefined otherwise.
        const user = verifyUser(req.body.email, req.body.password);
        if (!user) return res.status(401).json({ message: 'Invalid email or password' });

        // Issue session cookie.
        signAuthCookie(res, { id: user.id, email: user.email });
        return res.json(user);
    }
);

/* 
POST /api/auth/logout
- Clears the auth cookie (stateless logout)
*/
router.post('/logout', (req, res) => {
    clearAuthCookie(res);
    res.status(204).send();
});

/* 
GET /api/auth/me
- Requires a valid token
- Returns the current user's profile
*/
router.get('/me', requireAuth, (req, res) => {
    const me = getUserById(req.user.id);
    if (!me) return res.status(404).json({ message: 'Not found' });
    res.json(me);
});

export default router;