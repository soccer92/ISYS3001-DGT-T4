// Auth middleware + helpers for signing/verifying JWTs in an httpOnly cookie.
import jwt from 'jsonwebtoken';

const COOKIE = process.env.JWT_COOKIE_NAME || 'token';

const SECRET = process.env.JWT_SECRET || 'secret';

const MAX_AGE_DAYS = Number(process.env.JWT_EXPIRES_DAYS || '7');

// Sign a JWT for the given payload
export function signAuthCookie(res, payload) {
    const token = jwt.sign(payload, SECRET, { expiresIn: `${MAX_AGE_DAYS}d` });
    res.cookie(COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: false, // Set true in production when serving over HTTPS
        maxAge: MAX_AGE_DAYS * 24 * 60 * 60 * 1000
    });
}

// Clear the auth cookie—used on logout.
export function clearAuthCookie(res) {
    res.clearCookie(COOKIE);
}

// Require a valid JWT before allowing access to the route.
export function requireAuth(req, res, next) {
    const token = req.cookies?.[COOKIE];
    if (!token) return res.status(401).json({ message: 'Unauthorised' });

    try {
        const decoded = jwt.verify(token, SECRET);
        req.user = { id: decoded.id, email: decoded.email };
        next();
    } catch {
        return res.status(401).json({ message: 'Invalid token' });
    }
}
