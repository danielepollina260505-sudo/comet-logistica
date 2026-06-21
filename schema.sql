-- COMET LOGISTICA PRO - Schema PostgreSQL

CREATE TABLE IF NOT EXISTS rimorchi (
  targa TEXT PRIMARY KEY,
  tipo TEXT DEFAULT '',
  stato TEXT DEFAULT 'VUOTO',
  posizione_rimorchio TEXT DEFAULT '',
  posizione_carico TEXT DEFAULT '',
  stato_operativo TEXT DEFAULT '',
  trattore TEXT DEFAULT '',
  carico_json TEXT DEFAULT '[]',
  scadenza_revisione TEXT DEFAULT '',
  scadenza_atp TEXT DEFAULT '',
  scadenza_assicurazione TEXT DEFAULT '',
  note TEXT DEFAULT '',
  data_inizio_viaggio TEXT DEFAULT '',
  data_inizio_giacenza TEXT DEFAULT '',
  data_fine_viaggio TEXT DEFAULT '',
  destinatario TEXT DEFAULT '',
  autista_carico TEXT DEFAULT '',
  autista_giacenza TEXT DEFAULT '',
  autista_scarico TEXT DEFAULT '',
  consegna_tassativa TEXT DEFAULT '',
  data_porto_inizio TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mezzi (
  targa TEXT PRIMARY KEY,
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
  mitt_indirizzo TEXT DEFAULT '',
  mitt_citta TEXT DEFAULT '',
  mitt_provincia TEXT DEFAULT '',
  kg NUMERIC DEFAULT 0,
  colli INTEGER DEFAULT 0,
  tipo_merce TEXT DEFAULT '',
  lunghezza NUMERIC DEFAULT 0,
  larghezza NUMERIC DEFAULT 0,
  altezza NUMERIC DEFAULT 0,
  diametro NUMERIC DEFAULT 0,
  stato TEXT DEFAULT 'IN_MAGAZZINO',
  data_carico TEXT DEFAULT '',
  data_tassativa TEXT DEFAULT '',
  data_consegna TEXT DEFAULT '',
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS planning (
  id TEXT PRIMARY KEY,
  data_prevista TEXT DEFAULT '',
  rimorchio TEXT DEFAULT '',
  autista TEXT DEFAULT '',
  destinazione TEXT DEFAULT '',
  kg NUMERIC DEFAULT 0,
  stato TEXT DEFAULT 'PROGRAMMATO',
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS epal_ledger (
  id SERIAL PRIMARY KEY,
  data TEXT DEFAULT '',
  tipo_movimento TEXT DEFAULT '',
  luogo TEXT DEFAULT '',
  quantita INTEGER DEFAULT 0,
  autista_targa TEXT DEFAULT '',
  note TEXT DEFAULT '',
  data_entrata TEXT DEFAULT '',
  data_uscita TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lff_ledger (
  id SERIAL PRIMARY KEY,
  data TEXT DEFAULT '',
  tipo_movimento TEXT DEFAULT '',
  luogo TEXT DEFAULT '',
  quantita INTEGER DEFAULT 0,
  autista_targa TEXT DEFAULT '',
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cvr_ledger (
  id SERIAL PRIMARY KEY,
  data TEXT DEFAULT '',
  tipo_movimento TEXT DEFAULT '',
  luogo TEXT DEFAULT '',
  quantita INTEGER DEFAULT 0,
  autista_targa TEXT DEFAULT '',
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS autisti (
  id TEXT PRIMARY KEY,
  cognome TEXT NOT NULL,
  targa TEXT DEFAULT '',
  scadenza_assicurazione TEXT DEFAULT '',
  scadenza_revisione TEXT DEFAULT '',
  note TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tratte_navi (
  id TEXT PRIMARY KEY,
  nave_linea TEXT DEFAULT '',
  porto_partenza TEXT DEFAULT '',
  porto_arrivo TEXT DEFAULT '',
  etd TEXT DEFAULT '',
  eta TEXT DEFAULT '',
  stato TEXT DEFAULT 'PROGRAMMATA',
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rubrica (
  id TEXT PRIMARY KEY,
  nome TEXT DEFAULT '',
  indirizzo TEXT DEFAULT '',
  citta TEXT DEFAULT '',
  provincia TEXT DEFAULT '',
  cap TEXT DEFAULT '',
  nazione TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  email TEXT DEFAULT '',
  note TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS config (
  chiave TEXT PRIMARY KEY,
  valore TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS storico (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_email TEXT DEFAULT '',
  action TEXT DEFAULT '',
  detail JSONB DEFAULT '{}'
);

-- Valori config di default
INSERT INTO config (chiave, valore) VALUES
  ('ALERT_SCADENZE_GIORNI', '30'),
  ('ALERT_TASSATIVE_GIORNI', '2'),
  ('ALERT_PORTO_WARN_GIORNI', '3'),
  ('ALERT_PORTO_DANGER_GIORNI', '4'),
  ('MAX_KG_DEFAULT', '30000'),
  ('MAGAZZINO_WARN_DAYS', '5'),
  ('MAGAZZINO_MAX_DAYS', '7')
ON CONFLICT (chiave) DO NOTHING;
