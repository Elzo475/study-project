process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
const express = require('express');
const path = require('path');
const session = require('express-session');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve the current folder (where server.js is) as static files
app.use(express.static(path.join(__dirname)));  // <-- serve root folder

// JSON + URL parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'YOUR_SECRET_KEY',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Helper
function isLoggedIn(req, res, next) {
    if (req.session.user) return next();
    return res.redirect('/login');
}

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Login route
app.get('/login', (req, res) => {
    if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET || !process.env.BASE_URL) {
        return res.status(500).send('Discord OAuth settings are not configured');
    }
    const redirect = encodeURIComponent(`${process.env.BASE_URL}/auth/discord/callback`);
    res.redirect(
        `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${redirect}&response_type=code&scope=identify`
    );
});

// Discord OAuth callback
app.get('/auth/discord/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).send('No code provided');

    try {
        const tokenResponse = await axios.post(
            'https://discord.com/api/oauth2/token',
            new URLSearchParams({
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: `${process.env.BASE_URL}/auth/discord/callback`,
                scope: 'identify'
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const accessToken = tokenResponse.data.access_token;

        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        req.session.user = userResponse.data;
        return res.redirect('/dashboard.html');
    } catch (err) {
        console.error('OAuth callback error:', err?.response?.data || err.message || err);
        return res.status(500).send('Error logging in');
    }
});

// Dashboard route
app.get('/dashboard', isLoggedIn, (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// API for frontend
app.get('/api/user', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });

    const defaultUser = {
        id: req.session.user.id,
        username: req.session.user.username,
        avatar: req.session.user.avatar,
        premium: false
    };

    return res.json(defaultUser);  // for now, just basic
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) console.error(err);
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

// Catch-all
app.use((req, res) => {
    res.status(404).send('404 - Not found');
});

// Express error-handling middleware (4 args required by Express)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error('Express error handler caught:', err);
    res.status(err.status || 500).send('Internal Server Error');
});

try {
    const server = app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));

    server.on('error', (err) => {
        console.error('Server bind/listen error:', err);
        process.exit(1);
    });
} catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
}