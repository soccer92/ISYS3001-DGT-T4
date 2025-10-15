// Auth middleware + helpers for signing/verifying JWTs in an httpOnly cookie.
import jwt from 'jsonwebtoken';

const COOKIE = process.env.JWT_COOKIE_NAME || 'token';

const SECRET = process.env.JWT_SECRET || 'secret';

const MAX_AGE_DAYS = Number(process.env.JWT_EXPIRES_DAYS || '7');

// Helpers
function getToken(req) {
    // Prefer secure cookie; allow Bearer for tools/tests.
    const bearer = req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null;
    return req.cookies?.[COOKIE] || bearer || null;
}

function isApiRequest(req) {
    return req.path.startsWith('/api/');
}

function wantsHTML(req) {
    // Treat GET non-API requests that accept HTML as “pages”
    const isApi = req.path.startsWith('/api/');
    return (
        !isApi &&
        req.method === 'GET' &&
        (req.headers.accept?.includes('text/html') ||
            req.path.endsWith('.html') ||
            req.path === '/')
    );
}

function redirectToLogin(req, res) {
    const nextUrl = encodeURIComponent(req.originalUrl || '/');
    res.redirect(302, `/login.html?next=${nextUrl}`);
}

// APIs

// Sign a JWT for the given payload
export function signAuthCookie(res, payload) {
    const isProd = process.env.NODE_ENV === 'production';
    const token = jwt.sign(payload, SECRET, { expiresIn: `${MAX_AGE_DAYS}d` });
    res.cookie(COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd, // Set true in production when serving over HTTPS
        maxAge: MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
        path: '/',
    });
}

// Clear the auth cookie—used on logout.
export function clearAuthCookie(res) {
    res.clearCookie(COOKIE, { path: '/' });
}

// Require a valid JWT before allowing access to the route.
export function requireAuth(req, res, next) {
    const token = req.cookies?.[COOKIE];
    if (!token) {
        return wantsHTML(req)
            ? redirectToLogin(req, res)
            : res.status(401).json({ message: 'Unauthorised' });
    }
    try {
        const decoded = jwt.verify(token, SECRET);
        req.user = { id: decoded.id, email: decoded.email };
        next();
    } catch {
        return wantsHTML(req)
            ? redirectToLogin(req, res)
            : res.status(401).json({ message: 'Invalid token' });
    }
}
