require('dotenv').config();
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// JSON + URL encoded parser (future extensibility)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session setup
app.use(session({
    secret: process.env.SESSION_SECRET || 'YOUR_SECRET_KEY',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
}));

// Helper: check if logged in
function isLoggedIn(req, res, next) {
    if (req.session.user) return next();
    return res.redirect('/login');
}

// Login route (redirect to Discord OAuth2)
app.get('/login', (req, res) => {
    if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET || !process.env.BASE_URL) {
        return res.status(500).send('Discord OAuth settings are not configured');
    }

    const redirect = encodeURIComponent(`${process.env.BASE_URL}/auth/discord/callback`);
    res.redirect(
        `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${redirect}&response_type=code&scope=identify`
    );
});

// Discord OAuth2 callback
app.get('/auth/discord/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).send('No code provided');

    try {
        // Exchange code for access token
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

        // Get user info
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        req.session.user = userResponse.data; // store user in session
        return res.redirect('/dashboard.html');
    } catch (err) {
        console.error('OAuth callback error:', err?.response?.data || err.message || err);
        return res.status(500).send('Error logging in');
    }
});

// Dashboard route (optional server-side check, still static page served)
app.get('/dashboard', isLoggedIn, (req, res) => {
    return res.redirect('/dashboard.html');
});

// API: return current user info + premium status
app.get('/api/user', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });

    const defaultUser = {
        id: req.session.user.id,
        username: req.session.user.username,
        avatar: req.session.user.avatar,
        premium: false
    };

    const premiumServiceUrl = process.env.PREMIUM_SERVICE_URL || 'http://localhost:4000/api/check-premium';

    axios
        .get(`${premiumServiceUrl}/${req.session.user.id}`)
        .then((premiumRes) => {
            return res.json({ ...defaultUser, premium: premiumRes.data?.premium === true });
        })
        .catch((err) => {
            console.warn('Premium API failed, falling back to false:', err?.message || err);
            return res.json(defaultUser);
        });
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destroy error:', err);
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

// Optional catch-all 404 (for API and dynamic endpoints)
app.use((req, res) => {
    res.status(404).send('404 - Not found');
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));