// common behavior for header auth and mobile menu
async function updateHeroButtons() {
    const loginBtn = document.getElementById('hero-login');
    const dashboardBtn = document.getElementById('hero-dashboard');

    try {
        const res = await fetch('/api/user');

        if (res.ok) {
            // user logged in
            if (loginBtn) loginBtn.style.display = 'none';
            if (dashboardBtn) dashboardBtn.style.display = 'inline-block';
        } else {
            // not logged in
            if (loginBtn) loginBtn.style.display = 'inline-block';
            if (dashboardBtn) dashboardBtn.style.display = 'none';
        }
    } catch {
        if (loginBtn) loginBtn.style.display = 'inline-block';
        if (dashboardBtn) dashboardBtn.style.display = 'none';
    }
}

updateHeroButtons();


window.addEventListener('DOMContentLoaded', () => {
    const mobileMenu = document.querySelector('.mobile-menu');
    const navLinks = document.querySelector('.nav-links');

    if (mobileMenu && navLinks) {
        mobileMenu.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
    });
});

async function initAuthHeader() {
    const authContainer = document.getElementById('auth-controls');
    if (!authContainer) return;

    try {
        const res = await fetch('/api/user');
        if (res.ok) {
            const user = await res.json();
            authContainer.innerHTML = `
                <li><a href="/dashboard.html" class="btn-primary">Dashboard</a></li>
                <li><a href="/logout" class="btn-secondary">Logout</a></li>
                <li class="logged-user">${user.username}</li>
            `;
            document.body.classList.add('logged-in');
        } else {
            authContainer.innerHTML = `<li><a href="/login" class="btn-primary">Login</a></li>`;
            document.body.classList.remove('logged-in');
        }
    } catch (err) {
        console.warn('Failed to fetch auth status', err);
        authContainer.innerHTML = `<li><a href="/login" class="btn-primary">Login</a></li>`;
    }
}

initAuthHeader();
