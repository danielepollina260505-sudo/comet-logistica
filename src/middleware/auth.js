'use strict';

const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

const sessions = new Map();

function createSession(email) {
    const token = require('crypto').randomUUID();
    sessions.set(token, { email, createdAt: Date.now() });
    return token;
}

function validateSession(token) {
    if (!token) return null;
    const s = sessions.get(token);
    if (!s) return null;
    if (Date.now() - s.createdAt > 8 * 60 * 60 * 1000) {
        sessions.delete(token);
        return null;
    }
    return s;
}

function authMiddleware(req, res, next) {
    const auth = req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const session = validateSession(token);
    if (!session) {
        return res.status(401).json({ ok: false, error: 'Non autenticato.' });
    }
    req.user = { email: session.email };
    next();
}

module.exports = { authMiddleware, createSession, validateSession, ALLOWED_EMAILS };