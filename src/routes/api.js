'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db');
const { randomUUID } = require('crypto');
const { calcolaAlert } = require('../db');

function audit(req, action, detail) {
    try {
        db.prepare('INSERT INTO storico (user_email,action,detail) VALUES (?,?,?)')
            .run(req.user ? .email || 'system', action, JSON.stringify(detail || {}));
    } catch {}
}

// PING
router.get('/ping', (req, res) => res.json({ ok: true, msg: 'PONG' }));

// DATI OPERATIVI
router.get('/data', (req, res) => {
    try {
        const rimorchi = db.prepare('SELECT * FROM rimorchi ORDER BY targa').all();
        rimorchi.forEach(r => {
            try { r.carico = JSON.parse(r.carico_json || '[]'); } catch { r.carico = []; }
        });
        const mezzi = db.prepare('SELECT * FROM mezzi ORDER BY targa').all();
        const magazzino = db.prepare('SELECT * FROM magazzino ORDER BY created_at DESC').all();
        const planning = db.prepare('SELECT * FROM planning ORDER BY data_prevista').all();
        const epal = db.prepare('SELECT * FROM epal_ledger ORDER BY data DESC').all();
        const autisti = db.prepare('SELECT * FROM autisti ORDER BY cognome').all();
        const navi = db.prepare('SELECT * FROM tratte_navi ORDER BY etd').all();
        const config = db.prepare('SELECT * FROM config').all();
        const alerts = calcolaAlert(rimorchi, mezzi);
        res.json({ ok: true, rimorchi, mezzi, magazzino, planning, epal, autisti, navi, config, alerts });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

// RIMORCHI
router.get('/rimorchi', (req, res) => {
    const rows = db.prepare('SELECT * FROM rimorchi ORDER BY targa').all();
    rows.forEach(r => { try { r.carico = JSON.parse(r.carico_json || '[]'); } catch { r.carico = []; } });
    res.json({ ok: true, rimorchi: rows });
});

router.post('/rimorchi', (req, res) => {
    try {
        const { targa, tipo, stato, note } = req.body || {};
        if (!targa) return res.status(400).json({ ok: false, error: 'Targa mancante' });
        const t = targa.toUpperCase().replace(/\s+/g, '');
        db.prepare('INSERT INTO rimorchi (targa,tipo,stato,note) VALUES (?,?,?,?)')
            .run(t, tipo || '', stato || 'VUOTO', note || '');
        audit(req, 'CREA_RIMORCHIO', { targa: t });
        res.json({ ok: true, targa: t });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.patch('/rimorchi/:targa', (req, res) => {
    try {
        const targa = req.params.targa.toUpperCase();
        const b = req.body || {};
        const campi = ['stato', 'posizione_rimorchio', 'trattore', 'scadenza_revisione',
            'scadenza_atp', 'scadenza_assicurazione', 'note', 'destinatario',
            'autista_carico', 'autista_giacenza', 'autista_scarico',
            'consegna_tassativa', 'data_porto_inizio', 'data_inizio_viaggio',
            'data_fine_viaggio', 'data_inizio_giacenza'
        ];
        const sets = [];
        const vals = [];
        campi.forEach(c => {
            if (c in b) {
                sets.push(`${c}=?`);
                vals.push(b[c]);
            }
        });
        if (!sets.length) return res.status(400).json({ ok: false, error: 'Nessun campo' });
        sets.push("updated_at=datetime('now')");
        db.prepare(`UPDATE rimorchi SET ${sets.join(',')} WHERE targa=?`).run(...vals, targa);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/rimorchi/:targa/carico', (req, res) => {
    try {
        const targa = req.params.targa.toUpperCase();
        const row = db.prepare('SELECT carico_json FROM rimorchi WHERE targa=?').get(targa);
        if (!row) return res.status(404).json({ ok: false, error: 'Non trovato' });
        let carico = [];
        try { carico = JSON.parse(row.carico_json || '[]'); } catch {}
        const item = {...req.body, id: req.body.id || randomUUID().slice(0, 8).toUpperCase() };
        carico.push(item);
        db.prepare("UPDATE rimorchi SET carico_json=?, stato='CARICO', updated_at=datetime('now') WHERE targa=?")
            .run(JSON.stringify(carico), targa);
        res.json({ ok: true, id: item.id });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.delete('/rimorchi/:targa', (req, res) => {
    db.prepare('DELETE FROM rimorchi WHERE targa=?').run(req.params.targa.toUpperCase());
    res.json({ ok: true });
});

// MEZZI
router.get('/mezzi', (req, res) => res.json({ ok: true, mezzi: db.prepare('SELECT * FROM mezzi').all() }));

router.post('/mezzi', (req, res) => {
    try {
        const { targa, autista, note } = req.body || {};
        if (!targa) return res.status(400).json({ ok: false, error: 'Targa mancante' });
        const t = targa.toUpperCase().replace(/\s+/g, '');
        db.prepare('INSERT INTO mezzi (targa,autista,note) VALUES (?,?,?)').run(t, autista || '', note || '');
        res.json({ ok: true, targa: t });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.delete('/mezzi/:targa', (req, res) => {
    db.prepare('DELETE FROM mezzi WHERE targa=?').run(req.params.targa.toUpperCase());
    res.json({ ok: true });
});

// MAGAZZINO
router.get('/magazzino', (req, res) => res.json({ ok: true, magazzino: db.prepare('SELECT * FROM magazzino').all() }));

router.post('/magazzino', (req, res) => {
    try {
        const b = req.body || {};
        if (!b.cliente || !b.materiale) return res.status(400).json({ ok: false, error: 'Dati mancanti' });
        const id = 'MZ-' + randomUUID().slice(0, 8).toUpperCase();
        db.prepare(`INSERT INTO magazzino (id,cliente,materiale,destinazione,kg,tipo_merce,colli,stato,data_carico,data_tassativa,note)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
            .run(id, b.cliente, b.materiale, b.destinazione || '', Number(b.kg) || 0, b.tipo_merce || '',
                Number(b.colli) || 0, b.stato || 'IN_MAGAZZINO',
                b.data_carico || new Date().toISOString().slice(0, 10), b.data_tassativa || '', b.note || '');
        audit(req, 'MAGAZZINO_ADD', { id });
        res.json({ ok: true, id });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.delete('/magazzino/:id', (req, res) => {
    db.prepare('DELETE FROM magazzino WHERE id=?').run(req.params.id);
    res.json({ ok: true });
});

// AUTISTI
router.get('/autisti', (req, res) => res.json({ ok: true, autisti: db.prepare('SELECT * FROM autisti ORDER BY cognome').all() }));

router.post('/autisti', (req, res) => {
    try {
        const { cognome, targa, note } = req.body || {};
        if (!cognome) return res.status(400).json({ ok: false, error: 'Cognome obbligatorio' });
        const id = randomUUID();
        db.prepare('INSERT OR REPLACE INTO autisti (id,cognome,targa,note) VALUES (?,?,?,?)')
            .run(id, cognome, targa || '', note || '');
        res.json({ ok: true, id });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.delete('/autisti/:id', (req, res) => {
    db.prepare('DELETE FROM autisti WHERE id=?').run(req.params.id);
    res.json({ ok: true });
});

// NAVI
router.get('/navi', (req, res) => res.json({ ok: true, navi: db.prepare('SELECT * FROM tratte_navi').all() }));

router.post('/navi', (req, res) => {
    try {
        const b = req.body || {};
        const id = 'NAV-' + randomUUID().slice(0, 8).toUpperCase();
        db.prepare('INSERT INTO tratte_navi (id,nave_linea,porto_partenza,porto_arrivo,etd,eta,stato,note) VALUES (?,?,?,?,?,?,?,?)')
            .run(id, b.nave_linea || '', b.porto_partenza || '', b.porto_arrivo || '', b.etd || '', b.eta || '', b.stato || 'PROGRAMMATA', b.note || '');
        res.json({ ok: true, id });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.delete('/navi/:id', (req, res) => {
    db.prepare('DELETE FROM tratte_navi WHERE id=?').run(req.params.id);
    res.json({ ok: true });
});

// EPAL
router.get('/epal', (req, res) => res.json({ ok: true, epal: db.prepare('SELECT * FROM epal_ledger ORDER BY data DESC').all() }));

router.post('/epal', (req, res) => {
    try {
        const b = req.body || {};
        db.prepare('INSERT INTO epal_ledger (data,tipo_movimento,luogo,quantita,autista_targa,note) VALUES (?,?,?,?,?,?)')
            .run(b.data || new Date().toISOString().slice(0, 10), b.tipo_movimento || '', b.luogo || '', Number(b.quantita) || 0, b.autista_targa || '', b.note || '');
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// CONFIG
router.get('/config', (req, res) => {
    const rows = db.prepare('SELECT * FROM config').all();
    const config = {};
    rows.forEach(r => { config[r.chiave] = r.valore; });
    res.json({ ok: true, config });
});

router.post('/config', (req, res) => {
    const payload = req.body || {};
    const stmt = db.prepare('INSERT OR REPLACE INTO config (chiave,valore) VALUES (?,?)');
    Object.entries(payload).forEach(([k, v]) => stmt.run(k, String(v)));
    res.json({ ok: true });
});

// AI
router.post('/ai/ask', async(req, res) => {
    try {
        const { prompt } = req.body || {};
        if (!prompt) return res.status(400).json({ ok: false, error: 'Prompt vuoto' });
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.json({ ok: true, text: '⚠️ Chiave Gemini API non configurata. Aggiungila nelle variabili d\'ambiente.' });
        const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
            }
        );
        const data = await response.json();
        if (data.error) return res.json({ ok: false, error: data.error.message });
        const text = data ? .candidates ? .[0] ? .content ? .parts ? .[0] ? .text || 'Nessuna risposta';
        res.json({ ok: true, text });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;