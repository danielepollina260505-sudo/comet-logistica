'use strict';
const express = require('express');
const router = express.Router();
const GAS_URL = process.env.GAS_URL;

async function callGAS(action, payload) {
  const params = new URLSearchParams({ action: action });
  const body = payload ? JSON.stringify(payload) : '{}';
  const res = await fetch(GAS_URL + '?' + params.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch(e) { return { ok: false, error: text }; }
}

router.get('/ping', async (req, res) => { try { res.json(await callGAS('api_ping')); } catch(e) { res.json({ ok: true }); } });
router.get('/data', async (req, res) => { try { res.json(await callGAS('getOperationalData')); } catch(e) { res.status(500).json({ ok: false, error: e.message }); } });
router.post('/gas/:action', async (req, res) => { try { res.json(await callGAS(req.params.action, req.body)); } catch(e) { res.status(500).json({ ok: false, error: e.message }); } });
router.get('/gas/:action', async (req, res) => { try { res.json(await callGAS(req.params.action, req.query)); } catch(e) { res.status(500).json({ ok: false, error: e.message }); } });

module.exports = router;
