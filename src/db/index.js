'use strict';
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/comet.db';
const dir = path.dirname(path.resolve(DB_PATH));
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS rimorchi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    targa TEXT NOT NULL UNIQUE,
    tipo TEXT DEFAULT '',
    stato TEXT DEFAULT 'VUOTO',
    posizione_rimorchio TEXT DEFAULT '',
    trattore TEXT DEFAULT '',
    carico_json TEXT DEFAULT '[]',
    scadenza_revisione TEXT DEFAULT '',
    scadenza_atp TEXT DEFAULT '',
    scadenza_assicurazione TEXT DEFAULT '',
    note TEXT DEFAULT '',
    data_inizio_viaggio TEXT DEFAULT '',
    data_fine_viaggio TEXT DEFAULT '',
    data_inizio_giacenza TEXT DEFAULT '',
    destinatario TEXT DEFAULT '',
    autista_carico TEXT DEFAULT '',
    autista_giacenza TEXT DEFAULT '',
    autista_scarico TEXT DEFAULT '',
    consegna_tassativa TEXT DEFAULT '',
    data_porto_inizio TEXT DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS mezzi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    targa TEXT NOT NULL UNIQUE,
    autista TEXT DEFAULT '',
    scadenza_revisione TEXT DEFAULT '',
    scadenza_tachigrafo TEXT DEFAULT '',
    scadenza_assicurazione TEXT DEFAULT '',
    note TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS magazzino (
    id TEXT PRIMARY KEY,
    cliente TEXT DEFAULT '',
    materiale TEXT DEFAULT '',
    destinazione TEXT DEFAULT '',
    kg REAL DEFAULT 0,
    tipo_merce TEXT DEFAULT '',
    colli INTEGER DEFAULT 0,
    stato TEXT DEFAULT 'IN_MAGAZZINO',
    data_carico TEXT DEFAULT '',
    data_tassativa TEXT DEFAULT '',
    indirizzo_consegna TEXT DEFAULT '',
    citta_consegna TEXT DEFAULT '',
    provincia_consegna TEXT DEFAULT '',
    telefono TEXT DEFAULT '',
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS planning (
    id TEXT PRIMARY KEY,
    data_prevista TEXT DEFAULT '',
    rimorchio TEXT DEFAULT '',
    autista TEXT DEFAULT '',
    cliente TEXT DEFAULT '',
    destinazione TEXT DEFAULT '',
    kg REAL DEFAULT 0,
    stato TEXT DEFAULT 'PROGRAMMATO',
    note TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS epal_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT DEFAULT (date('now')),
    tipo_movimento TEXT DEFAULT '',
    luogo TEXT DEFAULT '',
    quantita INTEGER DEFAULT 0,
    autista_targa TEXT DEFAULT '',
    note TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS autisti (
    id TEXT PRIMARY KEY,
    cognome TEXT NOT NULL,
    targa TEXT DEFAULT '',
    scadenza_assicurazione TEXT DEFAULT '',
    scadenza_revisione TEXT DEFAULT '',
    note TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS tratte_navi (
    id TEXT PRIMARY KEY,
    nave_linea TEXT DEFAULT '',
    porto_partenza TEXT DEFAULT '',
    porto_arrivo TEXT DEFAULT '',
    etd TEXT DEFAULT '',
    eta TEXT DEFAULT '',
    stato TEXT DEFAULT 'PROGRAMMATA',
    note TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS storico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now')),
    user_email TEXT DEFAULT '',
    action TEXT DEFAULT '',
    detail TEXT DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS config (
    chiave TEXT PRIMARY KEY,
    valore TEXT DEFAULT ''
  );
  INSERT OR IGNORE INTO config VALUES ('ALERT_SCADENZE_GIORNI','30');
  INSERT OR IGNORE INTO config VALUES ('MAX_KG_DEFAULT','30000');
  INSERT OR IGNORE INTO config VALUES ('MAGAZZINO_WARN_DAYS','5');
`);

module.exports = db;
// ALERT
function calcolaAlert(rimorchi, mezzi) {
    const alerts = [];
    const oggi = new Date();
    const giorni = 30;

    function controlla(data, msg, targa) {
        if (!data) return;
        const d = new Date(data);
        if (isNaN(d)) return;
        const diff = Math.floor((d - oggi) / 86400000);
        if (diff <= giorni) alerts.push({ type: diff < 0 ? 'danger' : 'warning', msg: `${msg} (tra ${diff} gg)`, targa });
    }
    (rimorchi || []).forEach(r => {
        controlla(r.scadenza_revisione, `Rimorchio ${r.targa}: Revisione`, r.targa);
        controlla(r.scadenza_assicurazione, `Rimorchio ${r.targa}: Assicurazione`, r.targa);
        controlla(r.scadenza_atp, `Rimorchio ${r.targa}: ATP`, r.targa);
    });
    (mezzi || []).forEach(m => {
        controlla(m.scadenza_revisione, `Mezzo ${m.targa}: Revisione`, m.targa);
        controlla(m.scadenza_assicurazione, `Mezzo ${m.targa}: Assicurazione`, m.targa);
    });
    return alerts;
}
exports.calcolaAlert = calcolaAlert;