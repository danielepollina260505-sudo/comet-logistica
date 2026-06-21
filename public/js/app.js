'use strict';

let STATE = { rimorchi: [], mezzi: [], magazzino: [], planning: [], epal: [], autisti: [], navi: [], config: {}, alerts: [] };
let dtR, dtM, dtP, dtE, dtN, dtA;

document.getElementById('user-label').textContent = localStorage.getItem('comet_email') || '';

async function api(method, path, body) {
    const res = await fetch('/api' + path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
    });
    return res.json();
}

async function loadAll() {
    const d = await api('GET', '/data');
    if (!d.ok) return;
    STATE = d;
    renderDashboard();
    renderFlotta();
    renderMagazzino();
    renderEpal();
    renderNavi();
    renderAutisti();
    loadConfig();
}

function showTab(name) {
    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.remove('active-view'));
    document.getElementById('view-' + name).classList.add('active-view');
    document.querySelectorAll('.sb-link').forEach(el => el.classList.remove('active'));
    event.target.closest('.sb-link').classList.add('active');
    document.getElementById('page-title').textContent = event.target.closest('.sb-link').textContent.trim();
}

function showModal(id) { new bootstrap.Modal(document.getElementById(id)).show(); }

function hideModal(id) { bootstrap.Modal.getInstance(document.getElementById(id)) ? .hide(); }

function renderDashboard() {
    const r = STATE.rimorchi || [];
    document.getElementById('kpi-r').textContent = r.length;
    document.getElementById('kpi-c').textContent = r.filter(x => x.stato === 'CARICO').length;
    document.getElementById('kpi-m').textContent = (STATE.magazzino || []).length;
    document.getElementById('kpi-a').textContent = (STATE.alerts || []).length;
    const box = document.getElementById('alerts-box');
    box.innerHTML = (STATE.alerts || []).map(a =>
        `<div class="alert-bar ${a.type}">${a.msg}</div>`).join('') || '<p class="text-secondary">Nessun alert</p>';
}

function renderFlotta() {
    const rows = (STATE.rimorchi || []).map(r => [
        r.targa, r.tipo || '—', r.stato,
        r.posizione_rimorchio || '—',
        r.autista_carico || r.autista_giacenza || '—',
        r.destinatario || '—',
        `<button class="btn btn-xs btn-outline-danger btn-sm" onclick="delRimorchio('${r.targa}')">✕</button>`
    ]);
    if (dtR) { dtR.clear().rows.add(rows).draw(); return; }
    dtR = $('#tbl-r').DataTable({ data: rows, language: { url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/it-IT.json' } });
}

function renderMagazzino() {
    const rows = (STATE.magazzino || []).map(m => [
        m.id, m.materiale, m.cliente, m.destinazione || '—',
        m.kg ? m.kg.toLocaleString() + ' kg' : '—',
        m.stato, m.data_tassativa || '—',
        `<button class="btn btn-sm btn-outline-danger" onclick="delMagazzino('${m.id}')">✕</button>`
    ]);
    if (dtM) { dtM.clear().rows.add(rows).draw(); return; }
    dtM = $('#tbl-m').DataTable({ data: rows, language: { url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/it-IT.json' } });
}

function renderEpal() {
    const rows = (STATE.epal || []).map(e => [e.data, e.tipo_movimento, e.luogo, e.quantita, e.autista_targa, e.note || '']);
    if (dtE) { dtE.clear().rows.add(rows).draw(); return; }
    dtE = $('#tbl-e').DataTable({ data: rows, language: { url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/it-IT.json' } });
}

function renderNavi() {
    const rows = (STATE.navi || []).map(n => [
        n.nave_linea, n.porto_partenza, n.porto_arrivo, n.etd || '—', n.eta || '—', n.stato,
        `<button class="btn btn-sm btn-outline-danger" onclick="delNave('${n.id}')">✕</button>`
    ]);
    if (dtN) { dtN.clear().rows.add(rows).draw(); return; }
    dtN = $('#tbl-n').DataTable({ data: rows, language: { url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/it-IT.json' } });
}

function renderAutisti() {
    const rows = (STATE.autisti || []).map(a => [
        a.cognome, a.targa || '—', a.scadenza_assicurazione || '—', a.note || '',
        `<button class="btn btn-sm btn-outline-danger" onclick="delAutista('${a.id}')">✕</button>`
    ]);
    if (dtA) { dtA.clear().rows.add(rows).draw(); return; }
    dtA = $('#tbl-a').DataTable({ data: rows, language: { url: '//cdn.datatables.net/plug-ins/1.13.4/i18n/it-IT.json' } });
}

async function salvaRimorchio() {
    const targa = document.getElementById('r-targa').value.trim();
    if (!targa) return alert('Targa obbligatoria');
    await api('POST', '/rimorchi', { targa, tipo: document.getElementById('r-tipo').value, note: document.getElementById('r-note').value });
    hideModal('modal-rimorchio');
    loadAll();
}

async function delRimorchio(targa) {
    if (!confirm('Eliminare ' + targa + '?')) return;
    await api('DELETE', '/rimorchi/' + targa);
    loadAll();
}

async function salvaMagazzino() {
    const cliente = document.getElementById('mag-cliente').value.trim();
    const materiale = document.getElementById('mag-materiale').value.trim();
    if (!cliente || !materiale) return alert('Cliente e materiale obbligatori');
    await api('POST', '/magazzino', {
        cliente,
        materiale,
        destinazione: document.getElementById('mag-destinazione').value,
        kg: document.getElementById('mag-kg').value,
        data_tassativa: document.getElementById('mag-tassativa').value
    });
    hideModal('modal-magazzino');
    loadAll();
}

async function delMagazzino(id) {
    if (!confirm('Eliminare?')) return;
    await api('DELETE', '/magazzino/' + id);
    loadAll();
}

async function salvaAutista() {
    const cognome = document.getElementById('aut-cognome').value.trim();
    if (!cognome) return alert('Cognome obbligatorio');
    await api('POST', '/autisti', { cognome, targa: document.getElementById('aut-targa').value, note: document.getElementById('aut-note').value });
    hideModal('modal-autista');
    loadAll();
}

async function delAutista(id) {
    if (!confirm('Eliminare?')) return;
    await api('DELETE', '/autisti/' + id);
    loadAll();
}

async function delNave(id) {
    if (!confirm('Eliminare?')) return;
    await api('DELETE', '/navi/' + id);
    loadAll();
}

async function loadConfig() {
    const d = await api('GET', '/config');
    if (!d.ok) return;
    Object.entries(d.config).forEach(([k, v]) => {
        const el = document.getElementById('cfg-' + k);
        if (el) el.value = v;
    });
}

async function saveConfig() {
    const payload = {};
    ['ALERT_SCADENZE_GIORNI', 'MAX_KG_DEFAULT', 'MAGAZZINO_WARN_DAYS'].forEach(k => {
        const el = document.getElementById('cfg-' + k);
        if (el) payload[k] = el.value;
    });
    await api('POST', '/config', payload);
    alert('Configurazione salvata');
}

function logout() {
    localStorage.clear();
    window.location.href = '/login.html';
}

// AI
function toggleAI() {
    document.getElementById('ai-box').classList.toggle('open');
}

async function sendAI() {
    const input = document.getElementById('ai-input');
    const msgs = document.getElementById('ai-msgs');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    msgs.innerHTML += `<div class="ai-msg user">${text}</div>`;
    msgs.innerHTML += `<div class="ai-msg bot" id="ai-typing">⏳ Elaboro...</div>`;
    msgs.scrollTop = msgs.scrollHeight;
    const d = await api('POST', '/ai/ask', { prompt: text });
    document.getElementById('ai-typing').textContent = d.text || d.error || 'Errore';
    msgs.scrollTop = msgs.scrollHeight;
}

// Avvio
loadAll();