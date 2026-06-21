'use strict';
const express = require('express');
const router = express.Router();
const { query, run } = require('../db');
const { randomUUID } = require('crypto');

function uid(prefix) {
  return (prefix || 'ID') + '-' + randomUUID().slice(0, 8).toUpperCase();
}

async function audit(email, action, detail) {
  try { await run('INSERT INTO storico (user_email,action,detail) VALUES ($1,$2,$3)', [email || 'system', action, JSON.stringify(detail || {})]); } catch {}
}

// ====================== PING ======================
router.get('/ping', (req, res) => res.json({ ok: true, msg: 'PONG' }));

// ====================== DATA PRINCIPALE ======================
router.get('/data', async (req, res) => {
  try {
    const rimorchi = await query('SELECT * FROM rimorchi ORDER BY targa');
    const mezzi = await query('SELECT * FROM mezzi ORDER BY targa');
    const magazzino = await query('SELECT * FROM magazzino ORDER BY created_at DESC');
    const planning = await query('SELECT * FROM planning ORDER BY data_prevista');
    const epal = await query('SELECT * FROM epal_ledger ORDER BY created_at DESC');
    const lff = await query('SELECT * FROM lff_ledger ORDER BY created_at DESC');
    const cvr = await query('SELECT * FROM cvr_ledger ORDER BY created_at DESC');
    const autisti = await query('SELECT * FROM autisti ORDER BY cognome');
    const navi = await query('SELECT * FROM tratte_navi ORDER BY etd');
    const rubrica = await query('SELECT * FROM rubrica ORDER BY nome');
    const cfgRows = await query('SELECT * FROM config');
    const config = {};
    cfgRows.forEach(r => { config[r.chiave] = r.valore; });
    const alerts = calcolaAlert(rimorchi, mezzi, magazzino, autisti, config);
    res.json({ ok: true, rimorchi, mezzi, magazzino, planning, epal, lff, cvr, autisti, navi, rubrica, config, alerts });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ====================== RIMORCHI ======================
router.get('/gas/api_ping', (req, res) => res.json({ ok: true, msg: 'PONG' }));

router.post('/gas/getOperationalData', async (req, res) => {
  try {
    const rimorchi = await query('SELECT * FROM rimorchi ORDER BY targa');
    const mezzi = await query('SELECT * FROM mezzi ORDER BY targa');
    const magazzino = await query('SELECT * FROM magazzino ORDER BY created_at DESC');
    const planning = await query('SELECT * FROM planning ORDER BY data_prevista');
    const epal = await query('SELECT * FROM epal_ledger ORDER BY created_at DESC');
    const lff = await query('SELECT * FROM lff_ledger ORDER BY created_at DESC');
    const cvr = await query('SELECT * FROM cvr_ledger ORDER BY created_at DESC');
    const autisti = await query('SELECT * FROM autisti ORDER BY cognome');
    const navi = await query('SELECT * FROM tratte_navi ORDER BY etd');
    const rubrica = await query('SELECT * FROM rubrica ORDER BY nome');
    const cfgRows = await query('SELECT * FROM config');
    const config = {};
    cfgRows.forEach(r => { config[r.chiave] = r.valore; });
    const alerts = calcolaAlert(rimorchi, mezzi, magazzino, autisti, config);
    res.json({ ok: true, rimorchi, mezzi, magazzino, planning, epal, lff, cvr, autisti, navi, rubrica, config, alerts });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_addRimorchio', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    const targa = String(p.Targa || p.targa || '').toUpperCase().replace(/\s+/g, '');
    if (!targa) return res.status(400).json({ ok: false, error: 'Targa obbligatoria' });
    await run(`INSERT INTO rimorchi (targa,tipo,stato,note) VALUES ($1,$2,$3,$4)
      ON CONFLICT (targa) DO NOTHING`,
      [targa, p.Tipo || p.tipo || '', p.Stato || p.stato || 'VUOTO', p.Note || p.note || '']);
    await audit(req.user?.email, 'CREA_RIMORCHIO', { targa });
    res.json({ ok: true, targa });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_deleteRow', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    const entity = p.entity || p.sheet;
    const id = p.id || p.targa || p.ID;
    const tableMap = {
      'Rimorchi': 'rimorchi', 'RIMORCHI': 'rimorchi',
      'Magazzino': 'magazzino', 'MAGAZZINO': 'magazzino',
      'Planning': 'planning', 'PLANNING': 'planning',
      'Autisti': 'autisti', 'AUTISTI': 'autisti',
      'Tratte_Navi': 'tratte_navi', 'NAVI': 'tratte_navi',
      'Rubrica': 'rubrica', 'RUBRICA': 'rubrica',
      'Mezzi': 'mezzi', 'MEZZI': 'mezzi',
    };
    const table = tableMap[entity];
    if (!table) return res.status(400).json({ ok: false, error: 'Entity non valida: ' + entity });
    const idCol = ['rimorchi', 'mezzi'].includes(table) ? 'targa' : 'id';
    await run(`DELETE FROM ${table} WHERE ${idCol} = $1`, [id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_updateRimorchioFields', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    const targa = String(p.targa || p.Targa || '').toUpperCase();
    const fields = p.fields || p.fieldsObj || p;
    if (!targa) return res.status(400).json({ ok: false, error: 'Targa mancante' });
    const colMap = {
      'Stato': 'stato', 'Tipo': 'tipo', 'Trattore': 'trattore',
      'Posizione Rimorchio': 'posizione_rimorchio', 'Posizione Carico': 'posizione_carico',
      'Stato Operativo': 'stato_operativo', 'Carico JSON': 'carico_json',
      'Scadenza Revisione': 'scadenza_revisione', 'Scadenza ATP': 'scadenza_atp',
      'Scadenza Assicurazione': 'scadenza_assicurazione', 'Note': 'note',
      'Data Inizio Viaggio': 'data_inizio_viaggio', 'Data Inizio Giacenza': 'data_inizio_giacenza',
      'Data Fine Viaggio': 'data_fine_viaggio', 'Destinatario': 'destinatario',
      'Autista Carico': 'autista_carico', 'Autista Giacenza': 'autista_giacenza',
      'Autista Scarico': 'autista_scarico', 'Consegna Tassativa': 'consegna_tassativa',
      'Data Porto Inizio': 'data_porto_inizio',
      'stato': 'stato', 'tipo': 'tipo', 'trattore': 'trattore',
      'posizione_rimorchio': 'posizione_rimorchio', 'carico_json': 'carico_json',
      'note': 'note', 'destinatario': 'destinatario',
      'autista_carico': 'autista_carico', 'autista_giacenza': 'autista_giacenza',
      'autista_scarico': 'autista_scarico',
    };
    const sets = []; const vals = [];
    Object.entries(fields).forEach(([k, v]) => {
      if (k === 'targa' || k === 'Targa' || k === 'fields' || k === 'fieldsObj') return;
      const col = colMap[k];
      if (col) { sets.push(`${col} = $${sets.length + 1}`); vals.push(v); }
    });
    if (!sets.length) return res.json({ ok: true });
    sets.push(`updated_at = NOW()`);
    vals.push(targa);
    await run(`UPDATE rimorchi SET ${sets.join(', ')} WHERE targa = $${vals.length}`, vals);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_inlineUpdate', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    const entity = p.entity; const id = p.id; const field = p.field; const value = p.value;
    const tableMap = {
      'Rimorchi': { table: 'rimorchi', idCol: 'targa' },
      'Magazzino': { table: 'magazzino', idCol: 'id' },
      'Planning': { table: 'planning', idCol: 'id' },
      'Autisti': { table: 'autisti', idCol: 'id' },
      'Tratte_Navi': { table: 'tratte_navi', idCol: 'id' },
      'Mezzi': { table: 'mezzi', idCol: 'targa' },
    };
    const info = tableMap[entity];
    if (!info) return res.status(400).json({ ok: false, error: 'Entity non valida' });
    // Usa campo snake_case direttamente
    const col = field.toLowerCase().replace(/ /g, '_');
    await run(`UPDATE ${info.table} SET ${col} = $1 WHERE ${info.idCol} = $2`, [value, id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_updateCell', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    res.json(await handleInlineUpdate(p));
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

async function handleInlineUpdate(p) {
  const entityKey = p.entityKey || p.entity;
  const id = p.id; const field = p.field; const value = p.value;
  const tableMap = {
    'rimorchi': { table: 'rimorchi', idCol: 'targa' },
    'Rimorchi': { table: 'rimorchi', idCol: 'targa' },
    'magazzino': { table: 'magazzino', idCol: 'id' },
    'Magazzino': { table: 'magazzino', idCol: 'id' },
    'planning': { table: 'planning', idCol: 'id' },
    'autisti': { table: 'autisti', idCol: 'id' },
    'navi': { table: 'tratte_navi', idCol: 'id' },
    'mezzi': { table: 'mezzi', idCol: 'targa' },
  };
  const info = tableMap[entityKey];
  if (!info) return { ok: false, error: 'Entity non valida: ' + entityKey };
  const col = String(field).toLowerCase().replace(/ /g, '_');
  await run(`UPDATE ${info.table} SET ${col} = $1 WHERE ${info.idCol} = $2`, [value, id]);
  return { ok: true };
}

router.post('/gas/api_updateTrailerDates', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    const targa = String(p.targa || '').toUpperCase();
    await run(`UPDATE rimorchi SET
      scadenza_revisione = COALESCE($1, scadenza_revisione),
      scadenza_assicurazione = COALESCE($2, scadenza_assicurazione),
      scadenza_atp = COALESCE($3, scadenza_atp),
      data_porto_inizio = COALESCE($4, data_porto_inizio),
      updated_at = NOW()
      WHERE targa = $5`,
      [p.scadenzaRevisione || null, p.scadenzaAssicurazione || null,
       p.scadenzaAtp || null, p.dataPortoInizio || null, targa]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_setTrailerCargoManual', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    const targa = String(p.targa || '').toUpperCase();
    const cargoItems = p.cargoItems || p.items || [];
    await run('UPDATE rimorchi SET carico_json = $1, updated_at = NOW() WHERE targa = $2',
      [JSON.stringify(cargoItems), targa]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_startTrip', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    const targa = String(p.targa || '').toUpperCase();
    const oggi = new Date().toISOString().slice(0, 10);
    await run(`UPDATE rimorchi SET stato='IN_VIAGGIO', data_inizio_viaggio=$1,
      autista_carico=COALESCE($2, autista_carico), trattore=COALESCE($3, trattore),
      destinatario=COALESCE($4, destinatario), updated_at=NOW() WHERE targa=$5`,
      [p.dataInizio || oggi, p.autista || null, p.trattore || null, p.destinatario || null, targa]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_endTrip', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    const targa = String(p.targa || '').toUpperCase();
    const oggi = new Date().toISOString().slice(0, 10);
    await run(`UPDATE rimorchi SET stato='VUOTO', data_fine_viaggio=$1,
      autista_scarico=COALESCE($2, autista_scarico), updated_at=NOW() WHERE targa=$2`,
      [p.dataFine || oggi, p.autista || null, targa]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_startLayover', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    const targa = String(p.targa || '').toUpperCase();
    const oggi = new Date().toISOString().slice(0, 10);
    await run(`UPDATE rimorchi SET stato='GIACENZA', data_inizio_giacenza=$1,
      autista_giacenza=COALESCE($2, autista_giacenza), updated_at=NOW() WHERE targa=$3`,
      [p.dataInizio || oggi, p.autista || null, targa]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_endLayover', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    const targa = String(p.targa || '').toUpperCase();
    await run(`UPDATE rimorchi SET stato='VUOTO', data_inizio_giacenza='', updated_at=NOW() WHERE targa=$1`, [targa]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_cloneRimorchio', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    const targa = String(p.targa || '').toUpperCase();
    const rows = await query('SELECT * FROM rimorchi WHERE targa=$1', [targa]);
    if (!rows.length) return res.json({ ok: false, error: 'Rimorchio non trovato' });
    const r = rows[0];
    const newTarga = targa + '_COPIA';
    await run(`INSERT INTO rimorchi (targa,tipo,stato,note) VALUES ($1,$2,'VUOTO',$3) ON CONFLICT DO NOTHING`,
      [newTarga, r.tipo, r.note]);
    res.json({ ok: true, newTarga });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ====================== AUTISTI ======================
router.post('/gas/api_getDriverRegistry', async (req, res) => {
  try {
    const autisti = await query('SELECT * FROM autisti ORDER BY cognome');
    res.json({ ok: true, autisti });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_upsertDriver', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    const cognome = String(p.Cognome || p.cognome || '').trim();
    if (!cognome) return res.status(400).json({ ok: false, error: 'Cognome obbligatorio' });
    const id = p.ID || p.id || uid('AUT');
    await run(`INSERT INTO autisti (id,cognome,targa,scadenza_assicurazione,scadenza_revisione,note)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (id) DO UPDATE SET cognome=$2,targa=$3,scadenza_assicurazione=$4,scadenza_revisione=$5,note=$6,updated_at=NOW()`,
      [id, cognome, p.Targa || p.targa || '', p['Scadenza Assicurazione'] || p.scadenza_assicurazione || '',
       p['Scadenza Revisione'] || p.scadenza_revisione || '', p.Note || p.note || '']);
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_deleteDriver', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    await run('DELETE FROM autisti WHERE id=$1', [p.id || p.ID]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_assignDriverToTrailer', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    const targa = String(p.targa || '').toUpperCase();
    const ruolo = p.ruolo || 'carico';
    const autista = p.autistaLabel || p.autista || '';
    const colMap = { carico: 'autista_carico', giacenza: 'autista_giacenza', scarico: 'autista_scarico' };
    const col = colMap[ruolo] || 'autista_carico';
    await run(`UPDATE rimorchi SET ${col}=$1, updated_at=NOW() WHERE targa=$2`, [autista, targa]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_unassignDriverFromTrailer', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    const targa = String(p.targa || '').toUpperCase();
    await run(`UPDATE rimorchi SET autista_carico='', autista_giacenza='', autista_scarico='', updated_at=NOW() WHERE targa=$1`, [targa]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ====================== MAGAZZINO ======================
router.post('/gas/api_addMagazzinoItem', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    if (!p.Cliente && !p.cliente) return res.status(400).json({ ok: false, error: 'Cliente mancante' });
    if (!p.Materiale && !p.materiale) return res.status(400).json({ ok: false, error: 'Materiale mancante' });
    const id = p.ID || p.id || uid('MZ');
    await run(`INSERT INTO magazzino (id,cliente,materiale,destinazione,mitt_indirizzo,mitt_citta,mitt_provincia,kg,colli,tipo_merce,stato,data_carico,data_tassativa,note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [id, p.Cliente || p.cliente, p.Materiale || p.materiale,
       p.Destinazione || p.destinazione || '',
       p['MittIndirizzoConsegna'] || '', p['MittCittaConsegna'] || '', p['MittProvinciaConsegna'] || '',
       Number(p.KG || p.kg) || 0, Number(p.Colli || p.colli) || 0,
       p['Tipo Merce'] || p.tipo_merce || '',
       p.Stato || p.stato || 'IN_MAGAZZINO',
       p['Data Carico'] || p.data_carico || new Date().toISOString().slice(0, 10),
       p['Data Tassativa'] || p.data_tassativa || '',
       p.Note || p.note || '']);
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_deleteMagazzinoItem', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    await run('DELETE FROM magazzino WHERE id=$1', [p.id || p.ID]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_unloadToWarehouse', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    const targa = String(p.targa || '').toUpperCase();
    const rows = await query('SELECT carico_json FROM rimorchi WHERE targa=$1', [targa]);
    if (!rows.length) return res.json({ ok: false, error: 'Rimorchio non trovato' });
    let cargo = [];
    try { cargo = JSON.parse(rows[0].carico_json || '[]'); } catch {}
    for (const item of cargo) {
      const id = item.ID || item.id || uid('MZ');
      await run(`INSERT INTO magazzino (id,cliente,materiale,destinazione,kg,stato,data_carico)
        VALUES ($1,$2,$3,$4,$5,'IN_MAGAZZINO',$6) ON CONFLICT (id) DO NOTHING`,
        [id, item.Cliente || item.cliente || '', item.Materiale || item.materiale || '',
         item.Destinazione || item.destinazione || '', Number(item.KG || item.kg) || 0,
         new Date().toISOString().slice(0, 10)]);
    }
    await run(`UPDATE rimorchi SET carico_json='[]', stato='VUOTO', updated_at=NOW() WHERE targa=$1`, [targa]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ====================== PLANNING ======================
router.post('/gas/api_savePlanningItem', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    const id = p.id || p.ID || uid('PL');
    await run(`INSERT INTO planning (id,data_prevista,rimorchio,autista,destinazione,kg,stato,note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (id) DO UPDATE SET data_prevista=$2,rimorchio=$3,autista=$4,destinazione=$5,kg=$6,stato=$7,note=$8`,
      [id, p.data_prevista || p['Data Prevista'] || '',
       p.rimorchio || p.Rimorchio || '',
       p.autista || p.Autista || '',
       p.destinazione || p.Destinazione || '',
       Number(p.kg || p.KG) || 0,
       p.stato || p.Stato || 'PROGRAMMATO',
       p.note || p.Note || '']);
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_deletePlanningItem', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    await run('DELETE FROM planning WHERE id=$1', [p.id || p.ID]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ====================== EPAL / LFF / CVR ======================
router.post('/gas/api_addEpalMovement', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    await run(`INSERT INTO epal_ledger (data,tipo_movimento,luogo,quantita,autista_targa,note,data_entrata,data_uscita)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [p.Data || p.data || new Date().toISOString().slice(0, 10),
       p['Tipo Movimento'] || p.tipo_movimento || '',
       p.Luogo || p.luogo || '',
       Number(p['Quantità'] || p.quantita) || 0,
       p['Autista/Targa'] || p.autista_targa || '',
       p.Note || p.note || '',
       p['Data Entrata'] || p.data_entrata || '',
       p['Data Uscita'] || p.data_uscita || '']);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_addLlfMovement', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    await run(`INSERT INTO lff_ledger (data,tipo_movimento,luogo,quantita,autista_targa,note) VALUES ($1,$2,$3,$4,$5,$6)`,
      [p.Data || p.data || new Date().toISOString().slice(0, 10),
       p['Tipo Movimento'] || p.tipo_movimento || '',
       p.Luogo || p.luogo || '',
       Number(p['Quantità'] || p.quantita) || 0,
       p['Autista/Targa'] || p.autista_targa || '',
       p.Note || p.note || '']);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_addCvrMovement', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    await run(`INSERT INTO cvr_ledger (data,tipo_movimento,luogo,quantita,autista_targa,note) VALUES ($1,$2,$3,$4,$5,$6)`,
      [p.Data || p.data || new Date().toISOString().slice(0, 10),
       p['Tipo Movimento'] || p.tipo_movimento || '',
       p.Luogo || p.luogo || '',
       Number(p['Quantità'] || p.quantita) || 0,
       p['Autista/Targa'] || p.autista_targa || '',
       p.Note || p.note || '']);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ====================== NAVI ======================
router.post('/gas/api_getNavi', async (req, res) => {
  try {
    const navi = await query('SELECT * FROM tratte_navi ORDER BY etd');
    res.json({ ok: true, navi });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_addNaveTrip', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    const id = p.id || p.ID || uid('NAV');
    await run(`INSERT INTO tratte_navi (id,nave_linea,porto_partenza,porto_arrivo,etd,eta,stato,note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, p['Nave/Linea'] || p.nave_linea || '',
       p['Porto Partenza'] || p.porto_partenza || '',
       p['Porto Arrivo'] || p.porto_arrivo || '',
       p.ETD || p.etd || '', p.ETA || p.eta || '',
       p.Stato || p.stato || 'PROGRAMMATA',
       p.Note || p.note || '']);
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_deleteNaveTrip', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    await run('DELETE FROM tratte_navi WHERE id=$1', [p.id || p.ID]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_updateNaveTripFields', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    const id = p.id || p.ID;
    const fields = p.fields || p;
    const colMap = {
      'Nave/Linea': 'nave_linea', 'Porto Partenza': 'porto_partenza', 'Porto Arrivo': 'porto_arrivo',
      'ETD': 'etd', 'ETA': 'eta', 'Stato': 'stato', 'Note': 'note',
      'nave_linea': 'nave_linea', 'porto_partenza': 'porto_partenza',
      'porto_arrivo': 'porto_arrivo', 'etd': 'etd', 'eta': 'eta', 'stato': 'stato', 'note': 'note'
    };
    const sets = []; const vals = [];
    Object.entries(fields).forEach(([k, v]) => {
      if (k === 'id' || k === 'ID' || k === 'fields') return;
      const col = colMap[k];
      if (col) { sets.push(`${col}=$${sets.length + 1}`); vals.push(v); }
    });
    if (!sets.length) return res.json({ ok: true });
    vals.push(id);
    await run(`UPDATE tratte_navi SET ${sets.join(',')} WHERE id=$${vals.length}`, vals);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ====================== RUBRICA ======================
router.post('/gas/api_getRubricaIndirizzi', async (req, res) => {
  try {
    const rubrica = await query('SELECT * FROM rubrica ORDER BY nome');
    res.json({ ok: true, rubrica });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_upsertRubricaIndirizzo', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    const id = p.id || p.ID || uid('RUB');
    await run(`INSERT INTO rubrica (id,nome,indirizzo,citta,provincia,cap,nazione,telefono,email,note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (id) DO UPDATE SET nome=$2,indirizzo=$3,citta=$4,provincia=$5,cap=$6,nazione=$7,telefono=$8,email=$9,note=$10`,
      [id, p.Nome || p.nome || '', p.Indirizzo || p.indirizzo || '',
       p.Citta || p.citta || '', p.Provincia || p.provincia || '',
       p.CAP || p.cap || '', p.Nazione || p.nazione || '',
       p.Telefono || p.telefono || '', p.Email || p.email || '',
       p.Note || p.note || '']);
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_deleteRubricaIndirizzo', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    await run('DELETE FROM rubrica WHERE id=$1', [p.id || p.ID]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ====================== CONFIG ======================
router.post('/gas/api_getConfig', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM config');
    const config = {};
    rows.forEach(r => { config[r.chiave] = r.valore; });
    res.json({ ok: true, config });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/gas/api_saveConfig', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    for (const [k, v] of Object.entries(p)) {
      await run(`INSERT INTO config (chiave,valore) VALUES ($1,$2) ON CONFLICT (chiave) DO UPDATE SET valore=$2`, [k, String(v)]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ====================== AI GEMINI ======================
router.post('/gas/api_askGemini', async (req, res) => {
  try {
    const p = req.body.payload || req.body || {};
    const prompt = p.prompt || p.testo || '';
    if (!prompt) return res.json({ ok: false, error: 'Prompt vuoto' });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.json({ ok: true, text: '⚠️ Chiave Gemini non configurata.' });
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }) }
    );
    const data = await response.json();
    if (data.error) return res.json({ ok: false, error: data.error.message });
    const text = (data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text) || 'Nessuna risposta';
    res.json({ ok: true, text });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ====================== STUB per funzioni non critiche ======================
const stubs = [
  'api_getDriverActivity', 'api_getDriverDashboard', 'api_suggestDriverForTrailer',
  'api_suggestLoadPairings', 'api_optimizeStopOrder', 'api_importMassivo',
  'api_buildWhatsappMessage', 'api_buildWhatsappFromTrailer', 'api_getTrailerReport',
  'api_sendFleetSummaryEmail', 'api_sendDailyAlertsEmail',
  'api_uploadDdt', 'api_getDdtList', 'api_deleteDdt', 'api_duplicateRow',
  'api_suggestTrailerForCargo', 'api_generateAutoCargoForTrailer',
];
stubs.forEach(name => {
  router.post('/gas/' + name, (req, res) => res.json({ ok: true, text: name + ' non ancora implementato', data: [] }));
});

// ====================== ALERT ENGINE ======================
function calcolaAlert(rimorchi, mezzi, magazzino, autisti, config) {
  const alerts = [];
  const oggi = new Date();
  const daysWarn = Number((config || {}).ALERT_SCADENZE_GIORNI || 30);
  const magWarn = Number((config || {}).MAGAZZINO_WARN_DAYS || 5);
  const portoWarn = Number((config || {}).ALERT_PORTO_WARN_GIORNI || 3);
  const portoDanger = Number((config || {}).ALERT_PORTO_DANGER_GIORNI || 4);

  function diffDays(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d)) return null;
    return Math.floor((d - oggi) / 86400000);
  }

  function check(dateStr, msg, targa) {
    const dd = diffDays(dateStr);
    if (dd === null || dd > daysWarn) return;
    alerts.push({ type: dd < 0 ? 'danger' : 'warning', category: 'scadenze', targa: targa || '', msg: msg + ' (tra ' + dd + ' gg)' });
  }

  (rimorchi || []).forEach(r => {
    check(r.scadenza_revisione, 'Rimorchio ' + r.targa + ': Revisione', r.targa);
    check(r.scadenza_atp, 'Rimorchio ' + r.targa + ': ATP', r.targa);
    check(r.scadenza_assicurazione, 'Rimorchio ' + r.targa + ': Assicurazione', r.targa);
    // Alert porto
    if (r.data_porto_inizio && r.posizione_rimorchio && /\(/.test(r.posizione_rimorchio)) {
      const days = Math.floor((oggi - new Date(r.data_porto_inizio)) / 86400000);
      if (days >= portoDanger) alerts.push({ type: 'danger', category: 'porto', targa: r.targa, msg: 'Rimorchio ' + r.targa + ': fermo al porto da ' + days + ' giorni' });
      else if (days >= portoWarn) alerts.push({ type: 'warning', category: 'porto', targa: r.targa, msg: 'Rimorchio ' + r.targa + ': fermo al porto da ' + days + ' giorni' });
    }
  });

  (mezzi || []).forEach(m => {
    check(m.scadenza_revisione, 'Mezzo ' + m.targa + ': Revisione', m.targa);
    check(m.scadenza_assicurazione, 'Mezzo ' + m.targa + ': Assicurazione', m.targa);
  });

  (autisti || []).forEach(a => {
    check(a.scadenza_assicurazione, 'Autista ' + a.cognome + ': Assicurazione', a.cognome);
    check(a.scadenza_revisione, 'Autista ' + a.cognome + ': Patente', a.cognome);
  });

  (magazzino || []).forEach(it => {
    const stato = String(it.stato || '').toUpperCase();
    if (!['IN_GIACENZA', 'IN_MAGAZZINO'].includes(stato)) return;
    const d0 = it.data_carico ? new Date(it.data_carico) : null;
    if (!d0 || isNaN(d0)) return;
    const dd = Math.floor((oggi - d0) / 86400000);
    if (dd >= magWarn) {
      alerts.push({ type: 'warning', category: 'magazzino', msg: 'Magazzino: ' + (it.materiale || it.id) + ' in giacenza da ' + dd + ' gg' });
    }
  });

  return alerts.slice(0, 80);
}

module.exports = router;
