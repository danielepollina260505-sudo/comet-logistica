'use strict';
const express = require('express');
const router = express.Router();
const { createSession, ALLOWED_EMAILS } = require('../middleware/auth');

router.post('/login', (req, res) => {
    const { email, secret } = req.body || {};
    if (!email || !secret) {
        return res.status(400).json({ ok: false, error: 'Email e secret obbligatori.' });
    }
    const emailLower = email.trim().toLowerCase();
    if (!ALLOWED_EMAILS.includes(emailLower)) {
        return res.status(403).json({ ok: false, error: `Email non autorizzata.` });
    }
    if (secret !== process.env.SESSION_SECRET) {
        return res.status(401).json({ ok: false, error: 'Codice di accesso non valido.' });
    }
    const token = createSession(emailLower);
    res.json({ ok: true, token, email: emailLower });
});

router.post('/logout', (req, res) => {
    res.json({ ok: true });
});

router.get('/me', (req, res) => {
    const auth = req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const { validateSession } = require('../middleware/auth');
    const session = validateSession(token);
    if (!session) return res.status(401).json({ ok: false });
    res.json({ ok: true, email: session.email });
});

module.exports = router;