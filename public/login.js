// Script for login.html file
(() => {
    const form = document.getElementById('loginForm');
    const err = document.getElementById('err');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        err.textContent = '';

        const fd = new FormData(form);
        const body = {
            email: fd.get('email'),
            password: fd.get('password')
        };

        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
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

        window.location.href = '/index.html';
    })
})();