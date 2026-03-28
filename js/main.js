// common behavior for header auth and mobile menu
async function updateHeroButtons() {
    const loginBtn = document.getElementById('hero-login');
    const dashboardBtn = document.getElementById('hero-dashboard');

    try {
        const res = await fetch('/api/user', { credentials: 'include' });

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
        const res = await fetch('/api/user', { credentials: 'include' });
        if (res.ok) {
            const user = await res.json();
            authContainer.innerHTML = `
                <li class="user-dropdown">
                    <button id="user-menu-button" type="button">
                        <img src="${user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : 'images/default-avatar.png'}" alt="${user.username} avatar">
                        <span>${user.username}</span>
                        <span class="chevron">▾</span>
                    </button>
                    <div class="user-menu" id="user-menu">
                        <a href="/dashboard">Dashboard</a>
                        <a href="/logout">Logout</a>
                    </div>
                </li>
            `;
            document.body.classList.add('logged-in');
            // Show dashboard button, hide login button in hero
            const heroLogin = document.getElementById('hero-login');
            const heroDashboard = document.getElementById('hero-dashboard');
            if (heroLogin) heroLogin.style.display = 'none';
            if (heroDashboard) heroDashboard.style.display = 'inline-block';

            const userButton = document.getElementById('user-menu-button');
            const userMenu = document.getElementById('user-menu');
            const userDropdown = document.querySelector('.user-dropdown');

            if (userButton && userMenu) {
                userButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    userMenu.classList.toggle('active');
                });

                document.addEventListener('click', (event) => {
                    if (!userDropdown?.contains(event.target)) {
                        userMenu.classList.remove('active');
                    }
                });
            }
        } else {
            authContainer.innerHTML = `<li><a href="/login" class="btn-primary">Login</a></li>`;
            document.body.classList.remove('logged-in');
            // Show login button, hide dashboard button in hero
            const heroLogin = document.getElementById('hero-login');
            const heroDashboard = document.getElementById('hero-dashboard');
            if (heroLogin) heroLogin.style.display = 'inline-block';
            if (heroDashboard) heroDashboard.style.display = 'none';
        }
    } catch (err) {
        console.warn('Failed to fetch auth status', err);
        authContainer.innerHTML = `<li><a href="/login" class="btn-primary">Login</a></li>`;
        // Default to showing login
        const heroLogin = document.getElementById('hero-login');
        const heroDashboard = document.getElementById('hero-dashboard');
        if (heroLogin) heroLogin.style.display = 'inline-block';
        if (heroDashboard) heroDashboard.style.display = 'none';
    }
}

initAuthHeader();
