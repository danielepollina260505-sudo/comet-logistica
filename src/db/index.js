'use strict';
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const DB_PATH = process.env.DB_PATH || './data/comet.db';
const dir = path.dirname(path.resolve(DB_PATH));

let db;

async function getDb() {
    if (db) return db;
    const SQL = await initSqlJs();
    try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch {}
    if (fs.existsSync(DB_PATH)) {
        db = new SQL.Database(fs.readFileSync(DB_PATH));
    } else {
        db = new SQL.Database();
    }
    db.run(`PRAGMA foreign_keys = ON;`);
    initSchema();
    return db;
}

function save() {
    try {
        const data = db.export();
        fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch {}
}

function initSchema() {
    db.run(`
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
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS planning (
      id TEXT PRIMARY KEY,
      data_prevista TEXT DEFAULT '',
      rimorchio TEXT DEFAULT '',
      autista TEXT DEFAULT '',
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
    save();
}

function query(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}

function run(sql, params = []) {
    db.run(sql, params);
    save();
}

module.exports = { getDb, query, run, save };