require('dotenv').config();

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
const BOT_API_URL = process.env.BOT_API_URL || null;

// JSON + URL parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.set('trust proxy', 1);
const isSecureCookie = process.env.NODE_ENV === 'production' && String(process.env.BASE_URL || '').startsWith('https://');
app.use(session({
    secret: process.env.SESSION_SECRET || 'YOUR_SECRET_KEY',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isSecureCookie,
        httpOnly: true,
        sameSite: isSecureCookie ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
}));

// Serve the current folder (where server.js is) as static files
app.use(express.static(path.join(__dirname)));  // <-- serve root folder


const { getUserStats, getRecentSessions, getCommandUsage } = require('./stats');
const { getCollection } = require('./db');

app.get('/api/user/:discordId', async (req, res) => {
    try {
        const discordId = req.params.discordId;

        const user = await getUserStats(discordId);

        const dailyStats = await getCollection('daily_stats')
            .find({ discordId })
            .sort({ date: 1 })
            .toArray();

        res.json({
            user,
            dailyStats
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

app.get('/api/stats', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });

    const discordId = req.session.user.id;

    try {
        const sessions = await getRecentSessions(discordId, 7);
        const commandUsage = await getCommandUsage(discordId);
        const dailyStats = await getCollection('daily_stats')
            .find({ discordId })
            .sort({ date: 1 })
            .toArray();

        res.json({
            sessions,
            commandUsage,
            dailyStats
        });
    } catch (err) {
        console.error('Unable to load dashboard stats:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

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
        return res.redirect('/dashboard');
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
app.get('/api/user', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });

    const discordId = req.session.user.id;
    let userStats = null;
    let dailyStats = [];
    let premiumUsers = 0;
    let botStats = {
        totalServers: 0,
        totalCommands: 0,
        premiumUsers: 0,
        totalMembers: 0,
        activeSessions: 0,
        uptime: null
    };

    try {
        userStats = await getUserStats(discordId);
        dailyStats = await getCollection('daily_stats')
            .find({ discordId })
            .sort({ date: 1 })
            .toArray();

        premiumUsers = await getCollection('users').countDocuments({ premium: true });
        botStats.premiumUsers = premiumUsers;

        if (BOT_API_URL) {
            try {
                const botResponse = await axios.get(`${BOT_API_URL}/api/bot-status`, { timeout: 2500 });
                if (botResponse.status === 200 && botResponse.data) {
                    const botData = botResponse.data;
                    botStats = {
                        ...botStats,
                        totalServers: botData.guildCount ?? botStats.totalServers,
                        totalCommands: botData.totalCommands ?? botStats.totalCommands,
                        premiumUsers: botData.premiumUsers ?? botStats.premiumUsers,
                        totalMembers: botData.totalMembers ?? botStats.totalMembers,
                        activeSessions: botData.activeSessions ?? botStats.activeSessions,
                        uptime: botData.uptimeSeconds ?? botData.uptime ?? botStats.uptime
                    };
                }
            } catch (error) {
                console.warn('Unable to fetch bot metrics from BOT_API_URL:', error?.message || error);
            }
        }
    } catch (err) {
        console.warn('Unable to load MongoDB stats:', err?.message || err);
    }

    res.json({
        id: discordId,
        username: req.session.user.username,
        avatar: req.session.user.avatar,
        premium: Boolean(userStats?.premium),
        email: userStats?.email || req.session.user.email || 'Not shared',
        roles: userStats?.roles || ['Student'],
        planExpires: userStats?.plan_expiry || 'No expiry set',
        userStats: userStats || {},
        dailyStats,
        botStats
    });
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