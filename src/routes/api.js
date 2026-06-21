'use strict';
const express = require('express');
const router = express.Router();
const { getDb, query, run } = require('../db');
const { randomUUID } = require('crypto');

function audit(email, action, detail) {
    try {
        run('INSERT INTO storico (user_email,action,detail) VALUES (?,?,?)', [email || 'system', action, JSON.stringify(detail || {})]);
    } catch {}
}

router.use(async(req, res, next) => {
    await getDb();
    next();
});

router.get('/ping', (req, res) => res.json({ ok: true, msg: 'PONG' }));

router.get('/data', (req, res) => {
    try {
        const rimorchi = query('SELECT * FROM rimorchi ORDER BY targa');
        rimorchi.forEach(r => { try { r.carico = JSON.parse(r.carico_json || '[]'); } catch { r.carico = []; } });
        const mezzi = query('SELECT * FROM mezzi ORDER BY targa');
        const magazzino = query('SELECT * FROM magazzino ORDER BY created_at DESC');
        const planning = query('SELECT * FROM planning ORDER BY data_prevista');
        const epal = query('SELECT * FROM epal_ledger ORDER BY data DESC');
        const autisti = query('SELECT * FROM autisti ORDER BY cognome');
        const navi = query('SELECT * FROM tratte_navi ORDER BY etd');
        const cfgRows = query('SELECT * FROM config');
        const config = {};
        cfgRows.forEach(r => { config[r.chiave] = r.valore; });
        const alerts = calcolaAlert(rimorchi, mezzi);
        res.json({ ok: true, rimorchi, mezzi, magazzino, planning, epal, autisti, navi, config, alerts });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.get('/rimorchi', (req, res) => {
    const rows = query('SELECT * FROM rimorchi ORDER BY targa');
    rows.forEach(r => { try { r.carico = JSON.parse(r.carico_json || '[]'); } catch { r.carico = []; } });
    res.json({ ok: true, rimorchi: rows });
});

router.post('/rimorchi', (req, res) => {
    try {
        const { targa, tipo, stato, note } = req.body || {};
        if (!targa) return res.status(400).json({ ok: false, error: 'Targa mancante' });
        const t = targa.toUpperCase().replace(/\s+/g, '');
        run('INSERT INTO rimorchi (targa,tipo,stato,note) VALUES (?,?,?,?)', [t, tipo || '', stato || 'VUOTO', note || '']);
        audit(req.user && req.user.email, 'CREA_RIMORCHIO', { targa: t });
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
        run(`UPDATE rimorchi SET ${sets.join(',')} WHERE targa=?`, [...vals, targa]);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.delete('/rimorchi/:targa', (req, res) => {
    run('DELETE FROM rimorchi WHERE targa=?', [req.params.targa.toUpperCase()]);
    res.json({ ok: true });
});

router.get('/mezzi', (req, res) => res.json({ ok: true, mezzi: query('SELECT * FROM mezzi') }));

router.post('/mezzi', (req, res) => {
    try {
        const { targa, autista, note } = req.body || {};
        if (!targa) return res.status(400).json({ ok: false, error: 'Targa mancante' });
        const t = targa.toUpperCase().replace(/\s+/g, '');
        run('INSERT INTO mezzi (targa,autista,note) VALUES (?,?,?)', [t, autista || '', note || '']);
        res.json({ ok: true, targa: t });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.delete('/mezzi/:targa', (req, res) => {
    run('DELETE FROM mezzi WHERE targa=?', [req.params.targa.toUpperCase()]);
    res.json({ ok: true });
});

router.get('/magazzino', (req, res) => res.json({ ok: true, magazzino: query('SELECT * FROM magazzino') }));

router.post('/magazzino', (req, res) => {
    try {
        const b = req.body || {};
        if (!b.cliente || !b.materiale) return res.status(400).json({ ok: false, error: 'Dati mancanti' });
        const id = 'MZ-' + randomUUID().slice(0, 8).toUpperCase();
        run(`INSERT INTO magazzino (id,cliente,materiale,destinazione,kg,tipo_merce,colli,stato,data_carico,data_tassativa,note) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [id, b.cliente, b.materiale, b.destinazione || '', Number(b.kg) || 0, b.tipo_merce || '', Number(b.colli) || 0,
            b.stato || 'IN_MAGAZZINO', b.data_carico || new Date().toISOString().slice(0, 10), b.data_tassativa || '', b.note || ''
        ]);
        res.json({ ok: true, id });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.delete('/magazzino/:id', (req, res) => {
    run('DELETE FROM magazzino WHERE id=?', [req.params.id]);
    res.json({ ok: true });
});

router.get('/autisti', (req, res) => res.json({ ok: true, autisti: query('SELECT * FROM autisti ORDER BY cognome') }));

router.post('/autisti', (req, res) => {
    try {
        const { cognome, targa, note } = req.body || {};
        if (!cognome) return res.status(400).json({ ok: false, error: 'Cognome obbligatorio' });
        const id = randomUUID();
        run('INSERT OR REPLACE INTO autisti (id,cognome,targa,note) VALUES (?,?,?,?)', [id, cognome, targa || '', note || '']);
        res.json({ ok: true, id });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.delete('/autisti/:id', (req, res) => {
    run('DELETE FROM autisti WHERE id=?', [req.params.id]);
    res.json({ ok: true });
});

router.get('/navi', (req, res) => res.json({ ok: true, navi: query('SELECT * FROM tratte_navi') }));

router.post('/navi', (req, res) => {
    try {
        const b = req.body || {};
        const id = 'NAV-' + randomUUID().slice(0, 8).toUpperCase();
        run('INSERT INTO tratte_navi (id,nave_linea,porto_partenza,porto_arrivo,etd,eta,stato,note) VALUES (?,?,?,?,?,?,?,?)', [id, b.nave_linea || '', b.porto_partenza || '', b.porto_arrivo || '', b.etd || '', b.eta || '', b.stato || 'PROGRAMMATA', b.note || '']);
        res.json({ ok: true, id });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.delete('/navi/:id', (req, res) => {
    run('DELETE FROM tratte_navi WHERE id=?', [req.params.id]);
    res.json({ ok: true });
});

router.get('/epal', (req, res) => res.json({ ok: true, epal: query('SELECT * FROM epal_ledger ORDER BY data DESC') }));

router.post('/epal', (req, res) => {
    try {
        const b = req.body || {};
        run('INSERT INTO epal_ledger (data,tipo_movimento,luogo,quantita,autista_targa,note) VALUES (?,?,?,?,?,?)', [b.data || new Date().toISOString().slice(0, 10), b.tipo_movimento || '', b.luogo || '', Number(b.quantita) || 0, b.autista_targa || '', b.note || '']);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.get('/config', (req, res) => {
    const rows = query('SELECT * FROM config');
    const config = {};
    rows.forEach(r => { config[r.chiave] = r.valore; });
    res.json({ ok: true, config });
});

router.post('/config', (req, res) => {
    const payload = req.body || {};
    Object.entries(payload).forEach(([k, v]) => run('INSERT OR REPLACE INTO config (chiave,valore) VALUES (?,?)', [k, String(v)]));
    res.json({ ok: true });
});

router.post('/ai/ask', async(req, res) => {
    try {
        const { prompt } = req.body || {};
        if (!prompt) return res.status(400).json({ ok: false, error: 'Prompt vuoto' });
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.json({ ok: true, text: '⚠️ Chiave Gemini non configurata.' });
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
        const text = (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) || 'Nessuna risposta';
        res.json({ ok: true, text });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

function calcolaAlert(rimorchi, mezzi) {
    const alerts = [];
    const oggi = new Date();

    function controlla(data, msg) {
        if (!data) return;
        const d = new Date(data);
        if (isNaN(d)) return;
        const diff = Math.floor((d - oggi) / 86400000);
        if (diff <= 30) alerts.push({ type: diff < 0 ? 'danger' : 'warning', msg: `${msg} (${diff<0?'scaduta da '+Math.abs(diff):'tra '+diff} gg)` });
    }
    (rimorchi || []).forEach(r => {
        controlla(r.scadenza_revisione, `Rimorchio ${r.targa}: Revisione`);
        controlla(r.scadenza_assicurazione, `Rimorchio ${r.targa}: Assicurazione`);
        controlla(r.scadenza_atp, `Rimorchio ${r.targa}: ATP`);
    });
    (mezzi || []).forEach(m => {
        controlla(m.scadenza_revisione, `Mezzo ${m.targa}: Revisione`);
        controlla(m.scadenza_assicurazione, `Mezzo ${m.targa}: Assicurazione`);
    });
    return alerts;
}

module.exports = router;