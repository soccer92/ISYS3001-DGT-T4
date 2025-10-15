// Script for login.html file.
(() => {
    const form = document.getElementById('loginForm');
    const err = document.getElementById('err');

    if (!form) return;

    // Read ?next from the URL (default to /index.html)
    function getNextUrl() {
        const params = new URLSearchParams(location.search);
        let nextUrl = params.get('next') || '/index.html';

        // Safety: force same-origin, relative path only
        try {
            const u = new URL(nextUrl, location.origin);
            if (u.origin !== location.origin) nextUrl = '/index.html';
            // Prevent protocol-relative //evil.com
            if (!u.pathname.startsWith('/')) nextUrl = '/index.html';
        } catch {
            nextUrl = '/index.html';
        }
        return nextUrl;
    }

    (async () => {
        try {
            const r = await fetch('/api/auth/me', { credentials: 'include' });
            if (r.ok) window.location.href = getNextUrl();
        } catch { }
    })();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        err.textContent = '';

        if (err) { err.textContent = ''; err.style.display = 'none'; }

        const fd = new FormData(form);
        const body = {
            email: String(fd.get('email') || '').trim().toLowerCase(),
            password: fd.get('password')
        };

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                credentials: 'include'
            });

            if (!res.ok) {
                let msg = 'Login failed';

                try {
                    const data = await res.json();
                    msg = data.message || (Array.isArray(data.errors) && data.errors[0]?.msg) || msg;
                } catch { }
                err.textContent = msg;
                return;
            }
            
            window.location.href = getNextUrl();
        } catch (ex) {
            err.textContent = 'Network error. Please try again.';
        }
    });
})();