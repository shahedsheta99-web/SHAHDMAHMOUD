// =====================================================================
//  app.js — screens, forms and printable reports.
// =====================================================================
import { store, newId } from './store.js';
import * as C from './calc.js';
import { FORMULAS, formulaById, fitsAge, recommendFormulas, regimenTotals, evaluateFormula } from './formulas.js';
import { LABS, labFlag } from './labs.js';
import { growthChart, trendChart } from './charts.js';

// ---------------- tiny helpers ----------------
const $ = (s, el = document) => el.querySelector(s);
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (x, d = 1) => (x == null || x === '' || isNaN(x) ? '—' : (+(+x).toFixed(d)).toLocaleString());
const fdate = (d) => (d ? new Date(d + (d.length === 10 ? 'T00:00' : '')).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const byDate = (a, b) => (a.date || '').localeCompare(b.date || '');
const latest = (arr) => (arr && arr.length ? arr.slice().sort(byDate)[arr.length - 1] : null);
const nl2br = (s) => h(s).replace(/\n/g, '<br>');

function getPath(o, path) { return path.split('.').reduce((x, k) => (x == null ? x : x[k]), o); }
function setPath(o, path, v) {
  const ks = path.split('.'); let cur = o;
  ks.slice(0, -1).forEach((k) => { if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {}; cur = cur[k]; });
  cur[ks[ks.length - 1]] = v;
}
function readForm(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'radio') { if (!el.checked) continue; setPath(o, el.name, isNaN(+el.value) || el.value === '' ? el.value : +el.value); continue; }
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'number') v = el.value === '' ? '' : +el.value;
    setPath(o, el.name, v);
  }
  return o;
}

// form field builder
function fld(label, name, val, o = {}) {
  const type = o.type || 'text';
  const a = `name="${name}"${o.req ? ' required' : ''}${o.placeholder ? ` placeholder="${h(o.placeholder)}"` : ''}`;
  if (type === 'checkbox') return `<label class="chk"><input type="checkbox" name="${name}" ${val ? 'checked' : ''}> <span>${h(label)}</span></label>`;
  let c;
  if (type === 'select') c = `<select ${a}>${o.options.map(([v, l]) => `<option value="${h(v)}" ${String(v) === String(val ?? '') ? 'selected' : ''}>${h(l)}</option>`).join('')}</select>`;
  else if (type === 'textarea') c = `<textarea ${a} rows="${o.rows || 3}" dir="auto">${h(val ?? '')}</textarea>`;
  else c = `<input type="${type}" ${a} value="${h(val ?? '')}"${type === 'number' ? ' step="any" inputmode="decimal"' : ''} dir="auto">`;
  return `<label class="fld ${o.cls || ''}"><span>${h(label)}${o.unit ? ` <em>${h(o.unit)}</em>` : ''}</span>${c}</label>`;
}
function radios(label, name, val, opts) {
  return `<fieldset class="radios"><legend>${h(label)}</legend>${opts.map(([v, l]) =>
    `<label class="radio"><input type="radio" name="${name}" value="${v}" ${String(val) === String(v) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</fieldset>`;
}
const wOpts = C.WEIGHT_OPTIONS;

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------------- settings (per device) ----------------
const SETTINGS_KEY = 'pn_settings_v1';
const settings = (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; } })();
const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {} };

// ---------------- state ----------------
const state = { patients: [], user: null, ready: false, dirty: false };
const getP = (id) => state.patients.find((p) => p.id === id);

function blankPatient() {
  return { id: newId(), createdAt: new Date().toISOString(), name: '', mrn: '', sex: '', dob: '', admissionDate: today(),
    ward: '', diagnosis: '', notes: '', status: 'active', assessments: [], pyms: [], followUps: [], measurements: [], discharge: {} };
}
function savePatient(p, msg = 'Saved') {
  const i = state.patients.findIndex((x) => x.id === p.id);
  if (i >= 0) state.patients[i] = p; else state.patients.push(p);
  state.dirty = false;
  store.save(p).catch((e) => alert('Save failed: ' + e.message));
  toast(msg);
}

// ---------------- routing ----------------
function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { parts, view: parts[0] || 'list' };
}
const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };
window.addEventListener('hashchange', () => { state.dirty = false; render(); });

// =====================================================================
//  RENDER
// =====================================================================
function render() {
  const app = $('#app');
  renderHeader();
  if (!state.ready) { app.innerHTML = '<div class="center muted">Loading…</div>'; return; }
  if (store.mode === 'cloud' && !state.user) { app.innerHTML = viewLogin(); return; }
  const { parts, view } = route();
  let html = '';
  try {
    if (view === 'list') html = viewList();
    else if (view === 'new') html = viewPatientForm(blankPatient(), true);
    else if (view === 'formulas') html = viewFormulas();
    else if (view === 'settings') html = viewSettings();
    else if (view === 'p') {
      const p = getP(parts[1]);
      if (!p) html = `<div class="card">Patient not found. <a href="#/">Back to list</a></div>`;
      else html = viewPatient(p, parts[2] || 'overview', parts.slice(3));
    } else html = viewList();
  } catch (e) { console.error(e); html = `<div class="card bad">Something went wrong: ${h(e.message)}</div>`; }
  app.innerHTML = html;
  afterRender();
  window.scrollTo({ top: 0 });
}

function renderHeader() {
  const u = state.user;
  $('#userbox').innerHTML = store.mode === 'cloud'
    ? (u ? `<span class="small muted hide-sm">${h(u.email)}</span> <button class="btn ghost sm" data-action="signout">Sign out</button>` : '')
    : `<span class="pill warn" title="Data is saved only on this device. See README to enable cloud sync.">Local mode</span>`;
}

// ---------------- login ----------------
function viewLogin() {
  return `<div class="card narrow">
    <h2>Sign in</h2>
    <p class="muted small">Use the same account on every device: phone, tablet or computer. Your patient files sync automatically.</p>
    <form id="loginForm">
      ${fld('Email', 'email', '', { type: 'email', req: true })}
      ${fld('Password', 'password', '', { type: 'password', req: true })}
      <div class="row gap"><button class="btn" name="act" value="in">Sign in</button>
      <button class="btn ghost" name="act" value="up">Create account</button></div>
      <p><a href="#" data-action="reset">Forgot password?</a></p>
    </form></div>`;
}

// ---------------- patient list ----------------
function viewList() {
  const q = (settings.search || '').toLowerCase();
  const filter = settings.filter || 'active';
  let list = state.patients.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  if (filter !== 'all') list = list.filter((p) => (p.status || 'active') === filter);
  if (q) list = list.filter((p) => [p.name, p.mrn, p.diagnosis, p.ward].join(' ').toLowerCase().includes(q));
  const cards = list.map((p) => {
    const a = C.ageAt(p.dob);
    const la = latest(p.assessments), res = la ? C.computeAssessment(p, la) : null;
    const lp = latest(p.pyms);
    const tot = lp ? (+lp.s1 || 0) + (+lp.s2 || 0) + (+lp.s3 || 0) + (+lp.s4 || 0) : null;
    const risk = C.pymsRisk(tot);
    return `<a class="pcard" href="#/p/${p.id}">
      <div class="pc-top"><strong dir="auto">${h(p.name || 'Unnamed')}</strong>
        ${p.status === 'discharged' ? '<span class="pill">Discharged</span>' : ''}
        ${risk ? `<span class="pill ${risk.cls}">PYMS ${tot}</span>` : ''}</div>
      <div class="small muted">${h(p.mrn ? 'MRN ' + p.mrn + ' · ' : '')}${p.sex === 'F' ? 'Female' : p.sex === 'M' ? 'Male' : ''} · ${C.ageText(a)} ${p.ward ? '· ' + h(p.ward) : ''}</div>
      <div class="small" dir="auto">${h(p.diagnosis || '')}</div>
      ${res?.energy.tee ? `<div class="small chips"><span>${fmt(res.energy.tee, 0)} kcal</span><span>${fmt(res.protein.value)} g ptn</span><span>${fmt(res.fluid.value, 0)} mL</span></div>` : ''}
    </a>`;
  }).join('');
  return `<div class="toolbar">
      <input type="search" id="search" placeholder="Search name, MRN, diagnosis…" value="${h(settings.search || '')}">
      <select id="filter">${[['active', 'Active'], ['discharged', 'Discharged'], ['all', 'All']].map(([v, l]) => `<option value="${v}" ${v === filter ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <a class="btn" href="#/new">+ New patient</a>
    </div>
    <div class="grid-cards">${cards || `<div class="card muted">No patients yet. Tap <b>+ New patient</b> to create a patient file.</div>`}</div>`;
}

// ---------------- patient demographics form ----------------
function viewPatientForm(p, isNew) {
  return `<div class="card">
    <h2>${isNew ? 'New patient' : 'Edit patient details'}</h2>
    <form id="patientForm" data-id="${p.id}" data-new="${isNew ? 1 : ''}">
      <div class="g3">
        ${fld('Patient name', 'name', p.name, { req: true, cls: 'span2' })}
        ${fld('Hospital no. / MRN', 'mrn', p.mrn)}
        ${fld('Sex', 'sex', p.sex, { type: 'select', req: true, options: [['', '— select —'], ['M', 'Male'], ['F', 'Female']] })}
        ${fld('Date of birth', 'dob', p.dob, { type: 'date', req: true })}
        ${fld('Admission date', 'admissionDate', p.admissionDate, { type: 'date' })}
        ${fld('Ward / Room', 'ward', p.ward)}
        ${fld('Diagnosis', 'diagnosis', p.diagnosis, { cls: 'span2' })}
        ${fld('Notes', 'notes', p.notes, { type: 'textarea', cls: 'span3' })}
      </div>
      <div class="row gap"><button class="btn">Save</button>
      <a class="btn ghost" href="${isNew ? '#/' : `#/p/${p.id}`}">Cancel</a>
      ${isNew ? '' : `<button type="button" class="btn danger right" data-action="deletePatient" data-id="${p.id}">Delete patient</button>`}</div>
    </form></div>`;
}

// ---------------- patient page with tabs ----------------
const TABS = [['overview', 'Overview'], ['assessment', 'Assessment'], ['formula', 'Formula'], ['growth', 'Growth'],
  ['pyms', 'PYMS'], ['followup', 'Follow-up'], ['discharge', 'Discharge'], ['print', 'Print']];

function viewPatient(p, tab, rest) {
  const a = C.ageAt(p.dob);
  const head = `<div class="phead">
    <div><a href="#/" class="small">← Patients</a>
      <h2 dir="auto">${h(p.name || 'Unnamed')} ${p.status === 'discharged' ? '<span class="pill">Discharged</span>' : ''}</h2>
      <div class="small muted">${p.mrn ? 'MRN ' + h(p.mrn) + ' · ' : ''}${p.sex === 'F' ? 'Female' : 'Male'} · ${C.ageText(a)} · DOB ${fdate(p.dob)} ${p.ward ? '· ' + h(p.ward) : ''} ${p.diagnosis ? '· <span dir="auto">' + h(p.diagnosis) + '</span>' : ''}</div>
    </div></div>
    <nav class="tabs no-print">${TABS.map(([k, l]) => `<a href="#/p/${p.id}/${k}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</nav>`;
  const body = {
    overview: () => tabOverview(p), edit: () => viewPatientForm(p, false), assessment: () => tabAssessment(p, rest[0]),
    formula: () => tabFormula(p, rest[0]), growth: () => tabGrowth(p), pyms: () => tabPyms(p, rest[0]),
    followup: () => tabFollowup(p, rest[0]), discharge: () => tabDischarge(p), print: () => tabPrint(p, rest[0]),
  }[tab] || (() => tabOverview(p));
  return head + body();
}

function needsCard(res, title = 'Nutrition requirements') {
  if (!res) return '';
  return `<div class="needs">
    <div class="need"><span>Energy</span><b>${fmt(res.energy.tee, 0)}</b><em>kcal/day</em><small>${res.energy.perKg ? fmt(res.energy.perKg, 0) + ' kcal/kg' : ''}</small></div>
    <div class="need"><span>Protein</span><b>${fmt(res.protein.value)}</b><em>g/day</em><small>${res.protein.gkg ? fmt(res.protein.gkg, 2) + ' g/kg' : ''}</small></div>
    <div class="need"><span>Fluid</span><b>${fmt(res.fluid.value, 0)}</b><em>mL/day</em><small>${res.fluid.perHour ? fmt(res.fluid.perHour, 0) + ' mL/h' : ''}</small></div>
  </div>`;
}

function tabOverview(p) {
  const la = latest(p.assessments), res = la ? C.computeAssessment(p, la) : null;
  const lp = latest(p.pyms), lf = latest(p.followUps);
  const tot = lp ? (+lp.s1 || 0) + (+lp.s2 || 0) + (+lp.s3 || 0) + (+lp.s4 || 0) : null;
  const risk = C.pymsRisk(tot);
  const reg = la?.regimen?.items?.length ? regimenTotals(la.regimen.items) : null;
  return `<div class="g2">
    <div class="card"><h3>Latest assessment ${la ? `<small class="muted">${fdate(la.date)}</small>` : ''}</h3>
      ${res ? `${needsCard(res)}
      <table class="kv"><tr><th>Weight / Height</th><td>${fmt(la.weight)} kg / ${fmt(la.height)} cm</td></tr>
      <tr><th>BMI</th><td>${fmt(res.bmi)} kg/m²</td></tr>
      <tr><th>IBW / Adjusted BW</th><td>${fmt(res.weights.ideal)} / ${fmt(res.weights.adjusted)} kg</td></tr>
      <tr><th>Current wt / IBW</th><td>${fmt(res.pctIBW, 0)} %</td></tr></table>`
      : '<p class="muted">No assessment yet.</p>'}
      <a class="btn sm" href="#/p/${p.id}/assessment">${la ? 'Open assessment' : 'Start assessment'}</a></div>
    <div class="card"><h3>Status</h3>
      <table class="kv">
      <tr><th>PYMS (latest)</th><td>${risk ? `<span class="pill ${risk.cls}">${tot} · ${risk.label}</span> <small>${fdate(lp.date)}</small>` : '—'}</td></tr>
      <tr><th>Current regimen</th><td>${reg ? `${la.regimen.items.map((i) => `${h(formulaById(i.id)?.name)} × ${fmt(i.servings)}`).join(', ')}<br><small>${fmt(reg.kcal, 0)} kcal · ${fmt(reg.protein)} g protein</small>` : '—'}</td></tr>
      <tr><th>Last follow-up</th><td>${lf ? fdate(lf.date) : '—'}</td></tr>
      <tr><th>Admission</th><td>${fdate(p.admissionDate)}</td></tr>
      ${p.status === 'discharged' ? `<tr><th>Discharged</th><td>${fdate(p.discharge?.date)}</td></tr>` : ''}
      </table>
      ${p.notes ? `<p class="small" dir="auto">${nl2br(p.notes)}</p>` : ''}
      <div class="row gap wrap"><a class="btn sm ghost" href="#/p/${p.id}/edit">Edit details</a>
      <a class="btn sm ghost" href="#/p/${p.id}/pyms/new">+ PYMS</a>
      <a class="btn sm ghost" href="#/p/${p.id}/followup/new">+ Follow-up</a>
      <a class="btn sm ghost" href="#/p/${p.id}/print">Print file</a></div></div>
  </div>`;
}

// =====================================================================
//  ASSESSMENT
// =====================================================================
function defaultAssessment(p) {
  const prev = latest(p.assessments);
  if (prev) return { ...JSON.parse(JSON.stringify(prev)), id: newId(), date: today() };
  const age = C.ageAt(p.dob)?.years ?? 5;
  const g = C.proteinGuide('aspen', age);
  return { id: newId(), date: today(), weight: '', height: '', usualWeight: '', muac: '', albumin: '',
    ibwTallMethod: 'bmi50', ibwOverride: '', adjFactor: 0.25,
    energy: { equation: 'W', weightBasis: 'actual', activity: 1.3, stress: 1.0 },
    protein: { guideline: 'aspen', weightBasis: 'actual', gPerKg: g?.max ?? 1.5 },
    fluid: { weightBasis: 'actual', percent: 100 }, concerns: {}, risk: {}, regimen: { items: [] } };
}

function tabAssessment(p, aid) {
  const list = (p.assessments || []).slice().sort(byDate);
  let a = aid === 'new' ? defaultAssessment(p) : list.find((x) => x.id === aid) || list[list.length - 1];
  const isNew = !list.some((x) => a && x.id === a.id);
  if (!a) a = defaultAssessment(p);
  const e = a.energy || {}, pr = a.protein || {}, fl = a.fluid || {}, cn = a.concerns || {}, rk = a.risk || {};
  const facOpts = (arr) => [...arr.map((x) => [x, x.toFixed(2).replace(/0$/, '')]), ['custom', 'Custom…']];
  const chips = list.map((x) => `<a class="chip ${x.id === a.id ? 'on' : ''}" href="#/p/${p.id}/assessment/${x.id}">${fdate(x.date)}</a>`).join('');
  return `<div class="row wrap gap no-print">${chips}<a class="chip add" href="#/p/${p.id}/assessment/new">+ ${list.length ? 'Reassessment' : 'New assessment'}</a></div>
  <form id="assessForm" data-pid="${p.id}" data-aid="${a.id}">
  <div class="g2">
   <div>
    <div class="card"><h3>Anthropometry</h3><div class="g3">
      ${fld('Assessment date', 'date', a.date, { type: 'date', req: true })}
      ${fld('Actual weight', 'weight', a.weight, { type: 'number', unit: 'kg' })}
      ${fld('Height / length', 'height', a.height, { type: 'number', unit: 'cm' })}
      ${fld('Usual / pre-illness wt', 'usualWeight', a.usualWeight, { type: 'number', unit: 'kg' })}
      ${fld('MUAC', 'muac', a.muac, { type: 'number', unit: 'cm' })}
      ${fld('Albumin', 'albumin', a.albumin, { type: 'number', unit: 'g/dL' })}
      ${fld('IBW method if Ht > 150 cm', 'ibwTallMethod', a.ibwTallMethod, { type: 'select', options: [['bmi50', '50th centile BMI × Ht²'], ['devine', 'Devine']], cls: 'span2' })}
      ${fld('IBW manual override', 'ibwOverride', a.ibwOverride, { type: 'number', unit: 'kg', placeholder: 'auto' })}
      ${fld('Adjusted BW factor', 'adjFactor', a.adjFactor ?? 0.25, { type: 'select', options: [[0.25, '0.25'], [0.4, '0.4'], [0.5, '0.5']] })}
    </div><p class="small muted">IBW for height ≤ 150 cm = (Ht × Ht × 1.65) / 1000. Adjusted BW = IBW + factor × (Actual − IBW).</p></div>

    <div class="card"><h3>Energy: Schofield</h3><div class="g3">
      ${fld('Equation', 'energy.equation', e.equation, { type: 'select', options: [['W', 'Schofield (weight)'], ['WH', 'Schofield (weight + height)']], cls: 'span2' })}
      ${fld('Weight used', 'energy.weightBasis', e.weightBasis, { type: 'select', options: wOpts })}
      ${fld('Custom weight', 'energy.customWeight', e.customWeight, { type: 'number', unit: 'kg', cls: 'cw' })}
      ${fld('Activity factor', 'energy.activity', e.activity, { type: 'select', options: facOpts(C.ACTIVITY_FACTORS) })}
      ${fld('Custom activity', 'energy.activityCustom', e.activityCustom, { type: 'number', cls: 'cact' })}
      ${fld('Stress factor', 'energy.stress', e.stress, { type: 'select', options: facOpts(C.STRESS_FACTORS) })}
      ${fld('Custom stress', 'energy.stressCustom', e.stressCustom, { type: 'number', cls: 'cstr' })}
      ${fld('Final kcal override', 'energy.override', e.override, { type: 'number', unit: 'kcal', placeholder: 'auto' })}
    </div></div>

    <div class="card"><h3>Protein: ASPEN</h3><div class="g3">
      ${fld('Guideline', 'protein.guideline', pr.guideline, { type: 'select', options: [['aspen', 'ASPEN critically ill / hospitalized'], ['dri', 'DRI (stable / maintenance)']], cls: 'span2' })}
      ${fld('Weight used', 'protein.weightBasis', pr.weightBasis, { type: 'select', options: wOpts })}
      ${fld('Custom weight', 'protein.customWeight', pr.customWeight, { type: 'number', unit: 'kg', cls: 'cw' })}
      ${fld('Protein', 'protein.gPerKg', pr.gPerKg, { type: 'number', unit: 'g/kg/day' })}
      ${fld('Final protein override', 'protein.override', pr.override, { type: 'number', unit: 'g', placeholder: 'auto' })}
    </div><p class="small muted" id="ptnGuide"></p></div>

    <div class="card"><h3>Fluid: Holliday–Segar</h3><div class="g3">
      ${fld('Weight used', 'fluid.weightBasis', fl.weightBasis, { type: 'select', options: wOpts })}
      ${fld('Custom weight', 'fluid.customWeight', fl.customWeight, { type: 'number', unit: 'kg', cls: 'cw' })}
      ${fld('% of maintenance', 'fluid.percent', fl.percent ?? 100, { type: 'number', unit: '%' })}
      ${fld('Final fluid override', 'fluid.override', fl.override, { type: 'number', unit: 'mL', placeholder: 'auto' })}
    </div><p class="small muted">100 mL/kg for first 10 kg + 50 mL/kg for next 10 kg + 20 mL/kg for each kg above 20.</p></div>
    <div class="card"><h3>Nutrition concerns</h3><div class="chkgrid">
      ${['vomiting', 'nausea', 'mucositis', 'diarrhea', 'constipation', 'dysphagia', 'refeeding risk'].map((k) => fld(k[0].toUpperCase() + k.slice(1), `concerns.${k.replace(' ', '_')}`, cn[k.replace(' ', '_')], { type: 'checkbox' })).join('')}
      </div>${fld('Other concerns', 'concerns.other', cn.other)}
      ${fld('Current diet order / regimen', 'dietOrder', a.dietOrder, { type: 'textarea', rows: 2 })}
      ${fld('Assessment notes', 'notes', a.notes, { type: 'textarea' })}
    </div>
    <details class="card" ${Object.values(rk).some(Boolean) ? 'open' : ''}><summary><h3>Oncology nutrition risk factors</h3></summary>
      <p class="small muted">%IBW and albumin are taken from the anthropometry section.</p>
      ${fld('Weight loss in 1 month', 'risk.wtLoss1m', rk.wtLoss1m, { type: 'number', unit: '%' })}
      <div class="chkgrid one">
      ${[['lowIntake', 'Oral intake < 50% of estimated needs for > 3 days (2)'], ['surgeryGIT', 'Surgery involving GIT (2)'], ['radiationGIT', 'Radiation involving GIT or CNS (2)'],
         ['bmt', 'BM transplant (2)'], ['enteritis', 'Radiation enteritis / dumping syndromes (2)'], ['gitProblem', 'GIT problem (typhlitis, ileus, mucositis…) (2)'],
         ['growthCurve', 'Change in growth percentile curve by 2 percentiles (2)'], ['wilms', 'Wilms tumor (III, IV, relapsed, unfavorable histology) (1)'],
         ['neuroblastoma', 'Neuroblastoma stage III–IV (1)'], ['metastatic', 'Metastatic solid tumors (1)'], ['nhl', 'NHL (III, IV, relapsed) (1)'],
         ['aml', 'AML, CML (new, relapsed) (1)'], ['all', 'ALL (high risk, relapsed) (1)'], ['brain', 'Medulloblastoma and other brain tumor (1)']]
        .map(([k, l]) => fld(l, `risk.${k}`, rk[k], { type: 'checkbox' })).join('')}
      </div><div id="riskResult"></div></details>
   </div>

   <div>
    <div class="card sticky" id="assessResults"></div>
   </div>
  </div>
  <div class="savebar no-print"><button class="btn">${isNew ? 'Save assessment' : 'Save changes'}</button>
    <a class="btn ghost" href="#/p/${p.id}/print/assessment">Print</a>
    ${!isNew ? `<button type="button" class="btn danger ghost right" data-action="deleteItem" data-kind="assessments" data-pid="${p.id}" data-iid="${a.id}">Delete</button>` : ''}</div>
  </form>`;
}

function assessResultsHTML(p, a) {
  const r = C.computeAssessment(p, a);
  const z = (v) => (v == null ? '—' : `${fmt(v, 2)} <small class="muted">(${fmt(C.pctFromZ(v), 0)}th)</small>`);
  return `<h3>Results</h3>
    ${needsCard(r)}
    <table class="kv">
      <tr><th>Age</th><td>${C.ageText(r.age)}</td></tr>
      <tr><th>BMI</th><td>${fmt(r.bmi)} kg/m²</td></tr>
      <tr><th>Ideal BW</th><td>${fmt(r.weights.ideal)} kg <small class="muted">${h(r.ibw?.method || '')}</small></td></tr>
      <tr><th>Adjusted BW</th><td>${fmt(r.weights.adjusted)} kg</td></tr>
      <tr><th>Current wt / IBW</th><td>${fmt(r.pctIBW, 0)} %</td></tr>
      ${r.wtChange != null ? `<tr><th>Weight change</th><td>${fmt(r.wtChange)} % vs usual</td></tr>` : ''}
      <tr><th>Wt/age z (centile)</th><td>${z(r.z.wfa)}</td></tr>
      <tr><th>Ht/age z (centile)</th><td>${z(r.z.hfa)}</td></tr>
      <tr><th>BMI/age z (centile)</th><td>${z(r.z.bfa)}</td></tr>
    </table>
    <div class="calc small">
      <p><b>REE</b> = ${r.energy.ree ? `${h(r.energy.ree.text)} → <b>${fmt(r.energy.ree.value)}</b> kcal (W = ${fmt(r.energy.weight)} kg)` : 'enter sex, DOB, weight' + (a.energy?.equation === 'WH' ? ' and height' : '')}</p>
      <p><b>TEE</b> = REE × ${fmt(r.energy.activity, 2)} (activity) × ${fmt(r.energy.stress, 2)} (stress) = <b>${fmt(r.energy.teeCalc, 0)}</b> kcal${r.energy.overridden ? ` → override <b>${fmt(r.energy.tee, 0)}</b>` : ''}</p>
      <p><b>Protein</b> = ${fmt(r.protein.gkg, 2)} g/kg × ${fmt(r.protein.weight)} kg = <b>${fmt(r.protein.calc)}</b> g${r.protein.overridden ? ` → override <b>${fmt(r.protein.value)}</b>` : ''}</p>
      <p><b>Fluid</b> = Holliday–Segar(${fmt(r.fluid.weight)} kg) ${fmt(r.fluid.hs, 0)} mL × ${fmt(r.fluid.percent, 0)}% = <b>${fmt(r.fluid.calc, 0)}</b> mL${r.fluid.overridden ? ` → override <b>${fmt(r.fluid.value, 0)}</b>` : ''}</p>
    </div>`;
}

function updateAssessLive() {
  const form = $('#assessForm'); if (!form) return;
  const p = getP(form.dataset.pid); const a = readForm(form);
  $('#assessResults').innerHTML = assessResultsHTML(p, a);
  // show "custom" inputs only when needed
  form.querySelectorAll('.cw').forEach((el) => {
    const sec = el.querySelector('input').name.split('.')[0];
    el.style.display = getPath(a, sec + '.weightBasis') === 'custom' ? '' : 'none';
  });
  form.querySelector('.cact').style.display = a.energy.activity === 'custom' ? '' : 'none';
  form.querySelector('.cstr').style.display = a.energy.stress === 'custom' ? '' : 'none';
  const r = C.computeAssessment(p, a);
  const g = r.protein.guide;
  $('#ptnGuide').textContent = g ? `${g.label}: ${g.min === g.max ? g.min : g.min + '–' + g.max} g/kg/day` : 'Enter date of birth to see the recommended range.';
  const rk = C.oncologyRisk(a.risk, r.pctIBW, a.albumin);
  $('#riskResult').innerHTML = `<p>%IBW points: ${rk.ibwPts} · Wt loss points: ${rk.wlPts} · Albumin points: ${rk.albPts}</p>
    <p><b>Total: ${rk.pts}</b> <span class="pill ${rk.cat.cls}">${rk.cat.label}</span> <small class="muted">(0–1 low, 2–3 moderate, ≥ 4 high)</small></p>`;
}

// =====================================================================
//  FORMULA
// =====================================================================
function tabFormula(p) {
  const a = latest(p.assessments);
  if (!a) return `<div class="card">Complete an <a href="#/p/${p.id}/assessment">assessment</a> first so the app knows the patient's needs.</div>`;
  const r = C.computeAssessment(p, a);
  const kcal = r.energy.tee, ptn = r.protein.value;
  const recs = recommendFormulas(r.ageY, kcal, ptn);
  const reg = a.regimen || { items: [] };
  const items = reg.items?.length ? reg.items : [{ id: recs[0]?.f.id || '', servings: recs[0] ? +recs[0].ev.servings.toFixed(1) : '' }];
  const rows = recs.map(({ f, ev }, i) => `<tr class="${i === 0 ? 'best' : ''}">
      <td><b>${h(f.name)}</b>${i === 0 ? ' <span class="pill good">Best match</span>' : ''}</td><td>${h(f.age)}</td>
      <td>${f.kcal} kcal / ${f.protein} g${f.scoops ? `<br><small>${f.scoops} scoops in ${f.volume} mL</small>` : ''}</td>
      <td>${fmt(ev.servings)}</td><td>${ev.scoops ? fmt(ev.scoops, 0) : '—'}</td><td>${ev.volume ? fmt(ev.volume, 0) + ' mL' : '—'}</td>
      <td>${fmt(ev.protein)} g <span class="pill ${ev.proteinPct < 90 ? 'warn' : ev.proteinPct > 130 ? 'warn' : 'good'}">${fmt(ev.proteinPct, 0)}%</span></td>
      <td><button type="button" class="btn sm ghost" data-action="useFormula" data-fid="${f.id}" data-serv="${ev.servings.toFixed(1)}">Use</button></td></tr>`).join('');
  const others = FORMULAS.filter((f) => !recs.some((x) => x.f.id === f.id));
  return `<div class="card"><h3>Targets from assessment of ${fdate(a.date)}</h3>${needsCard(r)}
    <p class="small muted">Age ${C.ageText(r.age)}. Products are filtered by age group, then ranked by how closely their protein matches the protein need when the full energy need is given by that product.</p></div>
  <div class="card"><h3>Recommended oral formulas</h3>
    ${recs.length ? `<div class="tablewrap"><table class="tbl"><thead><tr><th>Product</th><th>Age gp.</th><th>Per serving</th><th>Servings/day for ${fmt(kcal, 0)} kcal</th><th>Scoops/day</th><th>Volume/day</th><th>Protein provided (vs ${fmt(ptn)} g)</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
    : '<p class="muted">No product in the list matches this age group (or needs are not calculated yet).</p>'}
    <details><summary class="small">Products not suitable for this age / add-ons (${others.length})</summary>
    <ul class="small">${others.map((f) => `<li>${h(f.name)}: ${h(f.age)}, ${f.kcal} kcal, ${f.protein} g protein ${f.type === 'module' ? '(add-on module)' : ''} ${fitsAge(f, r.ageY) ? '' : '<span class="muted">not for this age</span>'}</li>`).join('')}</ul></details>
  </div>
  <form id="regimenForm" class="card" data-pid="${p.id}" data-aid="${a.id}"><h3>Prescribed regimen</h3>
    <div id="regRows">${items.map((it) => regimenRow(it)).join('')}</div>
    <button type="button" class="btn sm ghost" data-action="addRegRow">+ Add product</button>
    <div class="g3">
      ${fld('Route', 'regimen.route', reg.route, { type: 'select', options: [['oral', 'Oral'], ['ngt', 'NGT'], ['ogt', 'OGT'], ['gastrostomy', 'Gastrostomy'], ['jejunostomy', 'Jejunostomy'], ['other', 'Other']] })}
      ${fld('Schedule / rate', 'regimen.schedule', reg.schedule, { placeholder: 'e.g. 5 feeds/day, or 60 mL/h over 20 h' })}
      ${fld('Notes', 'regimen.notes', reg.notes)}
    </div>
    <div id="regTotals"></div>
    <div class="row gap"><button class="btn">Save regimen</button><a class="btn ghost" href="#/p/${p.id}/print/formula">Print</a></div>
  </form>`;
}
function regimenRow(it = {}) {
  const k = 'r' + newId();
  return `<div class="regrow g3">
    ${fld('Product', `regimen.items.${k}.id`, it.id, { type: 'select', options: [['', '— select —'], ...FORMULAS.map((f) => [f.id, `${f.name} (${f.age})`])], cls: 'span2' })}
    <div class="row gap end">${fld('Servings/day', `regimen.items.${k}.servings`, it.servings, { type: 'number' })}
    <button type="button" class="btn sm ghost" data-action="rmRow" title="Remove">✕</button></div></div>`;
}
function regimenTotalsHTML(items, r) {
  const t = regimenTotals(items);
  const pct = (x, y) => (y ? `<span class="pill ${x / y < 0.9 ? 'warn' : x / y > 1.15 ? 'warn' : 'good'}">${fmt((x / y) * 100, 0)}%</span>` : '');
  return `<table class="tbl compact"><thead><tr><th></th><th>Provided</th><th>Target</th><th>% of need</th></tr></thead><tbody>
    <tr><td>Energy</td><td>${fmt(t.kcal, 0)} kcal</td><td>${fmt(r.energy.tee, 0)} kcal</td><td>${pct(t.kcal, r.energy.tee)}</td></tr>
    <tr><td>Protein</td><td>${fmt(t.protein)} g</td><td>${fmt(r.protein.value)} g</td><td>${pct(t.protein, r.protein.value)}</td></tr>
    <tr><td>Formula volume</td><td>${fmt(t.volume, 0)} mL</td><td>${fmt(r.fluid.value, 0)} mL fluid</td><td>${pct(t.volume, r.fluid.value)}</td></tr>
    <tr><td>Scoops/day</td><td>${fmt(t.scoops, 0)}</td><td></td><td></td></tr></tbody></table>`;
}
const normItems = (obj) => Object.values(obj || {}).filter((x) => x.id).map((x) => ({ id: x.id, servings: x.servings }));
function updateRegimenLive() {
  const form = $('#regimenForm') || $('#fuForm'); if (!form) return;
  const p = getP(form.dataset.pid); const a = latest(p.assessments);
  const box = form.querySelector('#regTotals'); if (!box) return;
  if (!a) { box.innerHTML = ''; return; }
  const d = readForm(form);
  box.innerHTML = regimenTotalsHTML(normItems(d.regimen?.items), C.computeAssessment(p, a));
}

// =====================================================================
//  GROWTH
// =====================================================================
function gatherPoints(p) {
  const pts = [];
  const add = (src, d, w, ht) => { if (d && (w || ht)) pts.push({ src, date: d, weight: +w || null, height: +ht || null }); };
  (p.assessments || []).forEach((a) => add('Assessment', a.date, a.weight, a.height));
  (p.measurements || []).forEach((m) => add('Measurement', m.date, m.weight, m.height));
  (p.pyms || []).forEach((m) => add('PYMS', m.date, m.weight, m.height));
  (p.followUps || []).forEach((m) => add('Follow-up', m.date, m.weight, m.height));
  if (p.discharge?.date) add('Discharge', p.discharge.date, p.discharge.weight, p.discharge.height);
  return pts.sort(byDate).map((x) => {
    const age = C.ageAt(p.dob, x.date); const b = C.bmi(x.weight, x.height);
    return { ...x, ageM: age?.months, ageY: age?.years, age, bmi: b, z: C.growthZ(p.sex, age?.months, x.weight, x.height, b) };
  });
}
function tabGrowth(p) {
  const pts = gatherPoints(p);
  const z = (v) => (v == null ? '—' : `${fmt(v, 2)} (${fmt(C.pctFromZ(v), 0)}th)`);
  const maxAge = Math.max(0, ...pts.map((x) => x.ageM || 0));
  const minAge = Math.min(999, ...pts.map((x) => x.ageM ?? 999));
  const charts = growthCharts(p, pts, minAge, maxAge);
  return `<div class="card"><h3>Measurements</h3>
    <div class="tablewrap"><table class="tbl"><thead><tr><th>Date</th><th>Age</th><th>Source</th><th>Wt (kg)</th><th>Ht (cm)</th><th>BMI</th><th>Wt/age z</th><th>Ht/age z</th><th>BMI/age z</th></tr></thead><tbody>
    ${pts.map((x) => `<tr><td>${fdate(x.date)}</td><td>${C.ageText(x.age)}</td><td>${x.src}</td><td>${fmt(x.weight)}</td><td>${fmt(x.height)}</td><td>${fmt(x.bmi)}</td><td>${z(x.z.wfa)}</td><td>${z(x.z.hfa)}</td><td>${z(x.z.bfa)}</td></tr>`).join('') || '<tr><td colspan="9" class="muted">No measurements yet.</td></tr>'}
    </tbody></table></div>
    <form id="measForm" data-pid="${p.id}" class="row gap wrap end no-print">
      ${fld('Date', 'date', today(), { type: 'date', req: true })}${fld('Weight', 'weight', '', { type: 'number', unit: 'kg' })}${fld('Height', 'height', '', { type: 'number', unit: 'cm' })}
      <button class="btn sm">+ Add measurement</button></form>
    <p class="small muted">Weights and heights from assessments, PYMS, follow-ups and discharge are included automatically.</p></div>
  ${charts}`;
}
function growthCharts(p, pts, minAge, maxAge) {
  if (!p.sex) return '<div class="card muted">Set the patient\'s sex to draw growth charts.</div>';
  const wp = pts.filter((x) => x.weight).map((x) => ({ ageM: x.ageM, value: x.weight, label: fdate(x.date) }));
  const hp = pts.filter((x) => x.height).map((x) => ({ ageM: x.ageM, value: x.height, label: fdate(x.date) }));
  const bp = pts.filter((x) => x.bmi).map((x) => ({ ageM: x.ageM, value: +x.bmi.toFixed(1), label: fdate(x.date) }));
  const showInf = !pts.length || minAge < 36, show2 = !pts.length || maxAge >= 24;
  let s = '<div class="g2 charts">';
  if (showInf) s += `<div class="card">${growthChart({ table: 'wtageinf', sex: p.sex, title: 'Weight-for-age 0–36 months', unit: 'kg', points: wp })}</div>`;
  if (show2) {
    s += `<div class="card">${growthChart({ table: 'wtage', sex: p.sex, title: 'Weight-for-age 2–20 years', unit: 'kg', points: wp })}</div>`;
    s += `<div class="card">${growthChart({ table: 'statage', sex: p.sex, title: 'Stature-for-age 2–20 years', unit: 'cm', points: hp })}</div>`;
    s += `<div class="card">${growthChart({ table: 'bmiage', sex: p.sex, title: 'BMI-for-age 2–20 years', unit: 'kg/m²', points: bp })}</div>`;
  }
  if (showInf && minAge < 24) s += '<div class="card small muted">Length-for-age (0–36 months) needs the CDC <i>lenageinf</i> file. Send it and it can be added.</div>';
  return s + '</div>';
}

// =====================================================================
//  PYMS
// =====================================================================
const pymsTotal = (e) => (+e.s1 || 0) + (+e.s2 || 0) + (+e.s3 || 0) + (+e.s4 || 0);
function tabPyms(p, eid) {
  const list = (p.pyms || []).slice().sort(byDate);
  const editing = eid === 'new' ? null : list.find((x) => x.id === eid);
  const showForm = eid === 'new' || editing;
  const table = `<div class="tablewrap"><table class="tbl"><thead><tr><th>Date</th><th>Wt</th><th>Ht</th><th>BMI</th><th>Cut-off</th><th>S1 BMI</th><th>S2 Wt loss</th><th>S3 Intake</th><th>S4 Next wk</th><th>Total</th><th></th></tr></thead><tbody>
    ${list.map((e) => { const t = pymsTotal(e), rk = C.pymsRisk(t); const age = C.ageAt(p.dob, e.date);
      return `<tr><td>${fdate(e.date)}</td><td>${fmt(e.weight)}</td><td>${fmt(e.height)}</td><td>${fmt(C.bmi(e.weight, e.height))}</td><td>${fmt(C.pymsCutoff(p.sex, age?.years))}</td>
      <td>${e.s1 ?? 0}</td><td>${e.s2 ?? 0}</td><td>${e.s3 ?? 0}</td><td>${e.s4 ?? 0}</td><td><span class="pill ${rk.cls}">${t} · ${rk.label}</span></td>
      <td class="no-print"><a class="btn sm ghost" href="#/p/${p.id}/pyms/${e.id}">Edit</a></td></tr>`; }).join('') || '<tr><td colspan="11" class="muted">No PYMS screening yet.</td></tr>'}
    </tbody></table></div>`;
  const trend = trendChart({ title: 'PYMS score by week', points: list.map((e) => ({ x: fdate(e.date).slice(0, 6), y: pymsTotal(e) })), yMinFixed: 0, yMaxFixed: 7 });
  return `<div class="card"><div class="row between"><h3>PYMS: Paediatric Yorkhill Malnutrition Score</h3>
    <div class="row gap no-print"><a class="btn sm" href="#/p/${p.id}/pyms/new">+ New weekly screening</a><a class="btn sm ghost" href="#/p/${p.id}/print/pyms">Print</a></div></div>
    ${table}${trend ? `<div class="trend">${trend}</div>` : ''}
    <p class="small muted">Score 0 = low risk, 1 = medium risk, ≥ 2 = high risk. Repeat weekly.</p></div>
  ${showForm ? pymsForm(p, editing) : ''}`;
}
function pymsForm(p, e) {
  const last = latest(p.pyms), la = latest(p.assessments);
  e = e || { id: newId(), date: today(), weight: last?.weight || la?.weight || '', height: last?.height || la?.height || '', s1: '', s2: 0, s3: 0, s4: 0 };
  return `<form id="pymsForm" class="card" data-pid="${p.id}" data-eid="${e.id}">
    <h3>${(p.pyms || []).some((x) => x.id === e.id) ? 'Edit' : 'New'} PYMS screening</h3>
    <div class="g3">${fld('Date', 'date', e.date, { type: 'date', req: true })}${fld('Weight', 'weight', e.weight, { type: 'number', unit: 'kg' })}${fld('Height', 'height', e.height, { type: 'number', unit: 'cm' })}</div>
    <div id="pymsBmi" class="small"></div>
    ${radios('S1: Is the BMI below the cut-off value in the table?', 's1', e.s1 === '' ? '' : e.s1, [[0, 'No (0)'], [2, 'Yes (2)']])}
    ${radios('S2: Has the child lost weight recently? (unintentional weight loss, clothes looser, poor weight gain if < 2 y)', 's2', e.s2, [[0, 'No (0)'], [1, 'Yes (1)']])}
    ${radios('S3: Has the child had a reduced intake (including feeds) for at least the past week?', 's3', e.s3, [[0, 'No, usual intake (0)'], [1, 'Yes, decrease of usual intake for at least the past week (1)'], [2, 'Yes, no intake (or a few sips of feed only) for at least the past week (2)']])}
    ${radios("S4: Will the child's nutrition be affected by the recent admission / condition for at least the next week?", 's4', e.s4, [[0, 'No (0)'], [1, 'Yes, decreased intake and/or increased requirements and/or increased losses (1)'], [2, 'Yes, no intake (or a few sips of feed only) for at least the next week (2)']])}
    ${fld('Notes', 'notes', e.notes, { type: 'textarea', rows: 2 })}
    <div class="pymsTotal" id="pymsTotal"></div>
    <div class="row gap"><button class="btn">Save screening</button><a class="btn ghost" href="#/p/${p.id}/pyms">Cancel</a>
    ${(p.pyms || []).some((x) => x.id === e.id) ? `<button type="button" class="btn danger ghost right" data-action="deleteItem" data-kind="pyms" data-pid="${p.id}" data-iid="${e.id}">Delete</button>` : ''}</div>
  </form>`;
}
function updatePymsLive(fromWeight) {
  const form = $('#pymsForm'); if (!form) return;
  const p = getP(form.dataset.pid); const d = readForm(form);
  const age = C.ageAt(p.dob, d.date); const b = C.bmi(d.weight, d.height); const cut = C.pymsCutoff(p.sex, age?.years);
  $('#pymsBmi').innerHTML = `BMI <b>${fmt(b)}</b> · cut-off for ${p.sex === 'F' ? 'girls' : 'boys'} aged ${age ? Math.floor(age.years) : '—'} y: <b>${fmt(cut)}</b>${b && cut ? (b < cut ? ' → <b class="bad-t">below cut-off</b>' : ' → above cut-off') : cut == null ? ' (table covers 1–17 y; select S1 manually)' : ''}`;
  if (b && cut && (fromWeight || d.s1 === undefined)) {
    const v = b < cut ? '2' : '0';
    form.querySelectorAll('input[name="s1"]').forEach((r) => { r.checked = r.value === v; });
    d.s1 = +v;
  }
  const t = pymsTotal(d), rk = C.pymsRisk(t);
  $('#pymsTotal').innerHTML = `Total PYMS score: <b>${t}</b> <span class="pill ${rk.cls}">${rk.label}</span>`;
}

// =====================================================================
//  FOLLOW-UP (daily sheet)
// =====================================================================
const VITALS = [['bp', 'BP', 'mmHg'], ['hr', 'HR', 'bpm'], ['temp', 'Temp', '°C'], ['cvp', 'CVP', ''], ['urine', 'Urine', 'mL'], ['ryle', 'Ryle', 'mL'], ['drains', 'Drains', 'mL'], ['intake', 'Total in', 'mL'], ['output', 'Total out', 'mL']];
function tabFollowup(p, fid) {
  const list = (p.followUps || []).slice().sort(byDate).reverse();
  if (fid) return fuForm(p, fid === 'new' ? null : list.find((x) => x.id === fid));
  const cards = list.map((f) => {
    const t = f.regimen?.items?.length ? regimenTotals(f.regimen.items) : null;
    const abn = LABS.filter(([k]) => labFlag(k, f.labs?.[k])).map(([k, l]) => `<span class="pill ${labFlag(k, f.labs[k]) === 'high' ? 'bad' : 'warn'}">${l} ${f.labs[k]}</span>`).join(' ');
    return `<div class="card fu"><div class="row between"><h3>${fdate(f.date)}</h3><div class="no-print"><a class="btn sm ghost" href="#/p/${p.id}/followup/${f.id}">Open</a></div></div>
      <div class="small">${f.oralDiet ? `<b>Oral diet:</b> ${h(f.oralDiet)} · ` : ''}${f.tubeType ? `<b>Tube:</b> ${h(f.tubeType)} · ` : ''}${t ? `<b>Formula:</b> ${f.regimen.items.map((i) => `${h(formulaById(i.id)?.name)} × ${fmt(i.servings)}`).join(', ')} = ${fmt(t.kcal, 0)} kcal / ${fmt(t.protein)} g` : ''}</div>
      ${f.events ? `<p class="small" dir="auto"><b>Events:</b> ${nl2br(f.events)}</p>` : ''}
      ${abn ? `<div class="small">Abnormal labs: ${abn}</div>` : ''}</div>`;
  }).join('');
  return `<div class="row gap no-print"><a class="btn" href="#/p/${p.id}/followup/new">+ New follow-up</a><a class="btn ghost" href="#/p/${p.id}/print/followup">Print follow-ups</a></div>
    ${cards || '<div class="card muted">No follow-up entries yet.</div>'}
    ${list.length ? `<div class="card"><h3>Lab trends</h3>${labTrendTable(p)}</div>` : ''}`;
}
function labTrendTable(p) {
  const list = (p.followUps || []).slice().sort(byDate);
  const used = LABS.filter(([k]) => list.some((f) => f.labs?.[k] !== '' && f.labs?.[k] != null));
  if (!used.length) return '<p class="muted small">No lab values entered.</p>';
  return `<div class="tablewrap"><table class="tbl compact labs"><thead><tr><th>Test</th><th>Ref.</th>${list.map((f) => `<th>${fdate(f.date).slice(0, 6)}</th>`).join('')}</tr></thead><tbody>
    ${used.map(([k, l, u, lo, hi]) => `<tr><td>${l} <small class="muted">${u}</small></td><td class="small muted">${lo ?? ''}${lo != null || hi != null ? '–' : ''}${hi ?? ''}</td>${list.map((f) => { const v = f.labs?.[k]; const fl = labFlag(k, v); return `<td class="${fl}">${v ?? ''}${fl === 'high' ? ' ↑' : fl === 'low' ? ' ↓' : ''}</td>`; }).join('')}</tr>`).join('')}
    </tbody></table></div>`;
}
function fuForm(p, f) {
  const isNew = !f;
  const la = latest(p.assessments), r = la ? C.computeAssessment(p, la) : null;
  const prev = latest(p.followUps);
  if (!f) f = { id: newId(), date: today(), rx: { kcal: r ? Math.round(r.energy.tee || 0) || '' : '', fluid: r ? Math.round(r.fluid.value || 0) || '' : '', protein: r ? +(r.protein.value || 0).toFixed(1) || '' : '' },
    oralDiet: prev?.oralDiet || '', tubeType: prev?.tubeType || '', regimen: prev?.regimen || la?.regimen || { items: [] }, labs: {}, vitals: {} };
  const items = f.regimen?.items?.length ? f.regimen.items : [{}];
  return `<form id="fuForm" data-pid="${p.id}" data-fid="${f.id}">
  <div class="card"><div class="row between"><h3>${isNew ? 'New' : 'Edit'} daily follow-up</h3><a href="#/p/${p.id}/followup" class="small no-print">← All follow-ups</a></div>
    <div class="g3">${fld('Date', 'date', f.date, { type: 'date', req: true })}${fld('Weight', 'weight', f.weight, { type: 'number', unit: 'kg' })}${fld('Height', 'height', f.height, { type: 'number', unit: 'cm' })}</div>
    <h4>Prescription</h4><div class="g5">
      ${fld('Total calories', 'rx.kcal', f.rx?.kcal, { type: 'number', unit: 'kcal' })}${fld('Fluids', 'rx.fluid', f.rx?.fluid, { type: 'number', unit: 'mL' })}
      ${fld('Protein', 'rx.protein', f.rx?.protein, { type: 'number', unit: 'g' })}${fld('Carb', 'rx.carb', f.rx?.carb, { type: 'number', unit: 'g' })}${fld('Lipid', 'rx.lipid', f.rx?.lipid, { type: 'number', unit: 'g' })}</div>
  </div>
  <div class="card"><h3>Feeding</h3><div class="g3">
      ${fld('Oral diet', 'oralDiet', f.oralDiet, { cls: 'span2' })}${fld('Tube type', 'tubeType', f.tubeType, { type: 'select', options: [['', 'None'], ['NGT', 'NGT'], ['OGT', 'OGT'], ['NJT', 'NJT'], ['Gastrostomy', 'Gastrostomy'], ['Jejunostomy', 'Jejunostomy'], ['Other', 'Other']] })}</div>
    <h4>Enteral / oral formula</h4><div id="regRows">${items.map((it) => regimenRow(it)).join('')}</div>
    <button type="button" class="btn sm ghost" data-action="addRegRow">+ Add product</button>
    ${fld('Feeding notes (rate, dilution, tolerance)', 'feedingNotes', f.feedingNotes, { type: 'textarea', rows: 2 })}
    <div id="regTotals"></div>
    ${fld('Parenteral / IV notes (free text)', 'parenteral', f.parenteral, { type: 'textarea', rows: 2 })}
  </div>
  <div class="card"><h3>New events and interventions</h3>
    ${fld('Events / interventions / medications', 'events', f.events, { type: 'textarea', rows: 4 })}
    ${fld('To follow', 'toFollow', f.toFollow, { type: 'textarea', rows: 2 })}</div>
  <div class="card"><h3>Vitals & balance</h3><div class="g5">${VITALS.map(([k, l, u]) => fld(l, `vitals.${k}`, f.vitals?.[k], { unit: u })).join('')}</div></div>
  <div class="card"><h3>Laboratory results</h3><div class="g5 labsgrid">
    ${LABS.map(([k, l, u, lo, hi]) => `<label class="fld lab"><span>${l} <em>${u}</em></span><input type="number" step="any" inputmode="decimal" name="labs.${k}" value="${h(f.labs?.[k] ?? '')}" class="${labFlag(k, f.labs?.[k])}"><small class="muted">${lo != null || hi != null ? `${lo ?? ''}–${hi ?? ''}` : ''}</small></label>`).join('')}
  </div></div>
  <div class="savebar no-print"><button class="btn">Save follow-up</button><a class="btn ghost" href="#/p/${p.id}/followup">Cancel</a>
  ${isNew ? '' : `<button type="button" class="btn danger ghost right" data-action="deleteItem" data-kind="followUps" data-pid="${p.id}" data-iid="${f.id}">Delete</button>`}</div>
  </form>`;
}

// =====================================================================
//  DISCHARGE
// =====================================================================
function dischargeAuto(p) {
  const pts = gatherPoints(p); const first = pts[0], lastW = pts.slice().reverse().find((x) => x.weight);
  const d = p.discharge || {};
  const los = p.admissionDate && d.date ? Math.round((new Date(d.date) - new Date(p.admissionDate)) / 86400000) : null;
  const fw = first?.weight, dw = +d.weight || lastW?.weight;
  const ps = (p.pyms || []).slice().sort(byDate);
  const la = latest(p.assessments), r = la ? C.computeAssessment(p, la) : null;
  return `<table class="kv">
    <tr><th>Admission → discharge</th><td>${fdate(p.admissionDate)} → ${fdate(d.date)} ${los != null ? `(${los} days)` : ''}</td></tr>
    <tr><th>Weight on admission → discharge</th><td>${fmt(fw)} → ${fmt(dw)} kg ${fw && dw ? `(${dw - fw >= 0 ? '+' : ''}${fmt(dw - fw)} kg, ${fmt(((dw - fw) / fw) * 100)}%)` : ''}</td></tr>
    <tr><th>PYMS first → last</th><td>${ps.length ? `${pymsTotal(ps[0])} (${fdate(ps[0].date)}) → ${pymsTotal(ps[ps.length - 1])} (${fdate(ps[ps.length - 1].date)})` : '—'}</td></tr>
    <tr><th>Last estimated needs</th><td>${r ? `${fmt(r.energy.tee, 0)} kcal · ${fmt(r.protein.value)} g protein · ${fmt(r.fluid.value, 0)} mL` : '—'}</td></tr>
  </table>`;
}
function tabDischarge(p) {
  const d = p.discharge || {};
  return `<form id="dischargeForm" data-pid="${p.id}">
  <div class="card"><h3>Discharge summary</h3>
    <div class="g3">${fld('Discharge date', 'date', d.date || today(), { type: 'date', req: true })}${fld('Discharge weight', 'weight', d.weight, { type: 'number', unit: 'kg' })}${fld('Discharge height', 'height', d.height, { type: 'number', unit: 'cm' })}</div>
    <div id="dcAuto">${dischargeAuto(p)}</div>
    ${fld('Nutrition course during admission', 'course', d.course, { type: 'textarea', rows: 4 })}
    ${fld('Discharge diet', 'diet', d.diet, { type: 'textarea', rows: 2 })}
    ${fld('Formula / supplements at home (product, scoops, dilution, times per day)', 'formulaPlan', d.formulaPlan, { type: 'textarea', rows: 3 })}
    ${fld('Recommendations', 'recommendations', d.recommendations, { type: 'textarea', rows: 3 })}
    ${fld('Follow-up appointment', 'followUp', d.followUp)}
    ${fld('Clinical dietitian', 'dietitian', d.dietitian || settings.dietitian)}
    ${fld('Mark patient as discharged', 'markDischarged', p.status === 'discharged', { type: 'checkbox' })}
  </div>
  <div class="savebar no-print"><button class="btn">Save discharge summary</button><button type="button" class="btn ghost" data-action="fillPlan" data-pid="${p.id}">Insert current regimen</button><a class="btn ghost" href="#/p/${p.id}/print/discharge">Print</a></div>
  </form>`;
}

// =====================================================================
//  PRINT / REPORTS
// =====================================================================
const SECTIONS = [['assessment', 'Assessment & requirements'], ['formula', 'Formula regimen'], ['growth', 'Growth charts'], ['pyms', 'PYMS'], ['followup', 'Follow-ups & labs'], ['discharge', 'Discharge summary']];
function tabPrint(p, only) {
  const sel = only ? [only] : (settings.printSections || SECTIONS.map((s) => s[0]));
  return `<div class="card no-print"><h3>Print / save as PDF</h3>
    <div class="chkgrid">${SECTIONS.map(([k, l]) => `<label class="chk"><input type="checkbox" class="psec" value="${k}" ${sel.includes(k) ? 'checked' : ''}> <span>${l}</span></label>`).join('')}</div>
    <div class="row gap"><button class="btn" data-action="print">🖨 Print</button><span class="small muted">Tip: choose "Save as PDF" in the print dialog to keep a PDF copy.</span></div></div>
  <div class="report" id="report">${reportHTML(p, sel)}</div>`;
}
function reportHTML(p, sel) {
  const a = C.ageAt(p.dob);
  let s = `<div class="rep-head"><div><h2>Clinical Nutrition Report</h2><div class="small">${h(settings.hospital || '')}</div></div><div class="small right-t">Printed ${fdate(today())}${settings.dietitian ? '<br>Dietitian: ' + h(settings.dietitian) : ''}</div></div>
    <table class="kv rep-pt"><tr><th>Name</th><td dir="auto">${h(p.name)}</td><th>MRN</th><td>${h(p.mrn)}</td></tr>
    <tr><th>Sex / Age</th><td>${p.sex === 'F' ? 'Female' : 'Male'} · ${C.ageText(a)}</td><th>DOB</th><td>${fdate(p.dob)}</td></tr>
    <tr><th>Diagnosis</th><td dir="auto">${h(p.diagnosis)}</td><th>Ward / Admission</th><td>${h(p.ward)} · ${fdate(p.admissionDate)}</td></tr></table>`;
  const la = latest(p.assessments), r = la ? C.computeAssessment(p, la) : null;
  if (sel.includes('assessment')) {
    s += `<section><h3>Assessment (${la ? fdate(la.date) : '—'})</h3>`;
    if (la) {
      const cn = Object.entries(la.concerns || {}).filter(([k, v]) => v && k !== 'other').map(([k]) => k.replace('_', ' '));
      if (la.concerns?.other) cn.push(la.concerns.other);
      s += `${needsCard(r)}<table class="kv">
        <tr><th>Weight / Height</th><td>${fmt(la.weight)} kg / ${fmt(la.height)} cm</td><th>BMI</th><td>${fmt(r.bmi)} kg/m²</td></tr>
        <tr><th>IBW</th><td>${fmt(r.weights.ideal)} kg</td><th>Adjusted BW</th><td>${fmt(r.weights.adjusted)} kg</td></tr>
        <tr><th>Current wt / IBW</th><td>${fmt(r.pctIBW, 0)} %</td><th>Usual weight</th><td>${fmt(la.usualWeight)} kg</td></tr>
        <tr><th>Wt/age z</th><td>${fmt(r.z.wfa, 2)}</td><th>Ht/age z · BMI/age z</th><td>${fmt(r.z.hfa, 2)} · ${fmt(r.z.bfa, 2)}</td></tr>
        <tr><th>REE</th><td colspan="3">${r.energy.ree ? `${h(r.energy.ree.text)} = ${fmt(r.energy.ree.value)} kcal (wt ${fmt(r.energy.weight)} kg)` : '—'}</td></tr>
        <tr><th>TEE</th><td colspan="3">REE × ${fmt(r.energy.activity, 2)} × ${fmt(r.energy.stress, 2)} = ${fmt(r.energy.teeCalc, 0)} kcal${r.energy.overridden ? ` (final ${fmt(r.energy.tee, 0)})` : ''}</td></tr>
        <tr><th>Protein</th><td colspan="3">${fmt(r.protein.gkg, 2)} g/kg × ${fmt(r.protein.weight)} kg = ${fmt(r.protein.calc)} g${r.protein.overridden ? ` (final ${fmt(r.protein.value)})` : ''} · ${h(r.protein.guide?.label || '')}</td></tr>
        <tr><th>Fluid</th><td colspan="3">Holliday–Segar (${fmt(r.fluid.weight)} kg) × ${fmt(r.fluid.percent, 0)}% = ${fmt(r.fluid.calc, 0)} mL${r.fluid.overridden ? ` (final ${fmt(r.fluid.value, 0)})` : ''} · ${fmt(r.fluid.perHour, 0)} mL/h</td></tr>
        ${cn.length ? `<tr><th>Concerns</th><td colspan="3">${h(cn.join(', '))}</td></tr>` : ''}
        ${la.dietOrder ? `<tr><th>Diet order</th><td colspan="3" dir="auto">${nl2br(la.dietOrder)}</td></tr>` : ''}
        ${la.notes ? `<tr><th>Notes</th><td colspan="3" dir="auto">${nl2br(la.notes)}</td></tr>` : ''}</table>`;
      if (Object.values(la.risk || {}).some(Boolean)) { const rk = C.oncologyRisk(la.risk, r.pctIBW, la.albumin); s += `<p>Oncology nutrition risk score: <b>${rk.pts}</b> (${rk.cat.label})</p>`; }
    } else s += '<p class="muted">No assessment.</p>';
    s += '</section>';
  }
  if (sel.includes('formula')) {
    s += '<section><h3>Formula regimen</h3>';
    const it = la?.regimen?.items || [];
    if (it.length && r) {
      s += `<table class="tbl compact"><thead><tr><th>Product</th><th>Servings/day</th><th>Scoops/day</th><th>Volume</th><th>kcal</th><th>Protein</th></tr></thead><tbody>
      ${it.map((i) => { const f = formulaById(i.id); if (!f) return ''; const n = +i.servings || 0; return `<tr><td>${h(f.name)}</td><td>${fmt(n)}</td><td>${f.scoops ? fmt(f.scoops * n, 0) : '—'}</td><td>${f.volume ? fmt(f.volume * n, 0) + ' mL' : '—'}</td><td>${fmt(f.kcal * n, 0)}</td><td>${fmt(f.protein * n)} g</td></tr>`; }).join('')}</tbody></table>
      ${regimenTotalsHTML(it, r)}<p class="small">Route: ${h(la.regimen.route || '—')} · ${h(la.regimen.schedule || '')} ${la.regimen.notes ? '· ' + h(la.regimen.notes) : ''}</p>`;
    } else s += '<p class="muted">No regimen saved.</p>';
    s += '</section>';
  }
  if (sel.includes('growth')) {
    const pts = gatherPoints(p);
    s += `<section class="pb"><h3>Growth</h3>${growthCharts(p, pts, Math.min(999, ...pts.map((x) => x.ageM ?? 999)), Math.max(0, ...pts.map((x) => x.ageM || 0)))}</section>`;
  }
  if (sel.includes('pyms')) {
    const list = (p.pyms || []).slice().sort(byDate);
    s += `<section><h3>PYMS screening</h3>${list.length ? `<table class="tbl compact"><thead><tr><th>Date</th><th>Wt</th><th>Ht</th><th>BMI</th><th>S1</th><th>S2</th><th>S3</th><th>S4</th><th>Total</th><th>Risk</th></tr></thead><tbody>
      ${list.map((e) => { const t = pymsTotal(e); return `<tr><td>${fdate(e.date)}</td><td>${fmt(e.weight)}</td><td>${fmt(e.height)}</td><td>${fmt(C.bmi(e.weight, e.height))}</td><td>${e.s1 ?? 0}</td><td>${e.s2 ?? 0}</td><td>${e.s3 ?? 0}</td><td>${e.s4 ?? 0}</td><td><b>${t}</b></td><td>${C.pymsRisk(t).label}</td></tr>`; }).join('')}</tbody></table>
      ${trendChart({ title: 'PYMS score by week', points: list.map((e) => ({ x: fdate(e.date).slice(0, 6), y: pymsTotal(e) })), yMinFixed: 0, yMaxFixed: 7 })}` : '<p class="muted">No PYMS entries.</p>'}</section>`;
  }
  if (sel.includes('followup')) {
    const list = (p.followUps || []).slice().sort(byDate);
    s += `<section class="pb"><h3>Follow-ups</h3>${list.map((f) => { const t = f.regimen?.items?.length ? regimenTotals(f.regimen.items) : null;
      return `<div class="rep-fu"><b>${fdate(f.date)}</b>${f.weight ? ` · Wt ${fmt(f.weight)} kg` : ''} · Rx: ${fmt(f.rx?.kcal, 0)} kcal, ${fmt(f.rx?.fluid, 0)} mL, ${fmt(f.rx?.protein)} g protein
      <div class="small">${f.oralDiet ? 'Oral: ' + h(f.oralDiet) + ' · ' : ''}${f.tubeType ? 'Tube: ' + h(f.tubeType) + ' · ' : ''}${t ? `Formula: ${f.regimen.items.map((i) => `${h(formulaById(i.id)?.name)} × ${fmt(i.servings)}`).join(', ')} (${fmt(t.kcal, 0)} kcal / ${fmt(t.protein)} g)` : ''}</div>
      ${f.feedingNotes ? `<div class="small" dir="auto">${nl2br(f.feedingNotes)}</div>` : ''}${f.parenteral ? `<div class="small" dir="auto">IV: ${nl2br(f.parenteral)}</div>` : ''}
      ${f.events ? `<div class="small" dir="auto">Events: ${nl2br(f.events)}</div>` : ''}${f.toFollow ? `<div class="small" dir="auto">To follow: ${nl2br(f.toFollow)}</div>` : ''}
      <div class="small">${VITALS.filter(([k]) => f.vitals?.[k]).map(([k, l]) => `${l}: ${h(f.vitals[k])}`).join(' · ')}</div></div>`; }).join('') || '<p class="muted">No follow-ups.</p>'}
      ${list.length ? '<h4>Lab trends</h4>' + labTrendTable(p) : ''}</section>`;
  }
  if (sel.includes('discharge')) {
    const d = p.discharge || {};
    s += `<section><h3>Discharge summary</h3>${dischargeAuto(p)}
      ${[['Nutrition course', d.course], ['Discharge diet', d.diet], ['Formula / supplements', d.formulaPlan], ['Recommendations', d.recommendations], ['Follow-up', d.followUp]]
        .filter(([, v]) => v).map(([l, v]) => `<p><b>${l}:</b><br><span dir="auto">${nl2br(v)}</span></p>`).join('')}
      <p class="sign">Clinical dietitian: ${h(d.dietitian || settings.dietitian || '')} &nbsp;&nbsp; Signature: ____________________</p></section>`;
  }
  return s;
}

// =====================================================================
//  FORMULAS + SETTINGS pages
// =====================================================================
function viewFormulas() {
  return `<div class="card"><h2>Oral formula list</h2><p class="small muted">From Nutrition.pdf. IV products are not included yet. To change this list edit <code>js/formulas.js</code>.</p>
    <div class="tablewrap"><table class="tbl"><thead><tr><th>ONS</th><th>Age gp.</th><th>Serv. size</th><th>Dilution</th><th>kcal</th><th>Protein (g)</th><th>g protein / 100 kcal</th><th>Note</th></tr></thead><tbody>
    ${FORMULAS.map((f) => `<tr><td><b>${h(f.name)}</b></td><td>${h(f.age)}</td><td>${f.scoops ? f.scoops + ' scoops' : '—'}</td><td>${f.volume ? f.volume + ' mL' : '—'}</td><td>${f.kcal}</td><td>${f.protein}</td><td>${fmt((f.protein / f.kcal) * 100)}</td><td class="small">${h(f.note)}</td></tr>`).join('')}
    </tbody></table></div></div>`;
}
function viewSettings() {
  return `<div class="card"><h2>Settings</h2>
    <form id="settingsForm"><div class="g2">${fld('Your name (printed on reports)', 'dietitian', settings.dietitian)}${fld('Hospital / unit (printed on reports)', 'hospital', settings.hospital)}</div>
    <button class="btn">Save settings</button></form></div>
  <div class="card"><h3>Data</h3>
    <p class="small">Mode: <b>${store.mode === 'cloud' ? 'Cloud sync (Firebase)' : 'Local (this device only)'}</b>${store.mode === 'local' ? '. Follow README step 2 to turn on accounts and syncing between devices.' : ''}</p>
    <div class="row gap wrap"><button class="btn ghost" data-action="export">Download backup (JSON)</button>
    <label class="btn ghost">Import backup<input type="file" id="importFile" accept=".json,application/json" hidden></label></div></div>
  <div class="card small muted"><h3>About</h3>
    <p>Energy: Schofield (1985). Protein: ASPEN pediatric recommendations. Fluid: Holliday–Segar. IBW ≤ 150 cm: (Ht² × 1.65)/1000. Growth: CDC 2000 LMS data. Screening: PYMS.</p>
    <p>This tool supports, and does not replace, clinical judgement. Always check results before use.</p></div>`;
}

// =====================================================================
//  EVENTS
// =====================================================================
function afterRender() {
  updateAssessLive(); updatePymsLive(false); updateRegimenLive();
}

document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.id === 'search') { settings.search = t.value; saveSettings(); const pos = t.selectionStart; render(); const s = $('#search'); s.focus(); s.setSelectionRange(pos, pos); return; }
  if (t.closest('form')) state.dirty = true;
  if (t.closest('#assessForm')) updateAssessLive();
  if (t.closest('#pymsForm')) updatePymsLive(['weight', 'height', 'date'].includes(t.name));
  if (t.closest('#regimenForm') || t.closest('#fuForm')) updateRegimenLive();
  if (t.closest('#fuForm') && t.name?.startsWith('labs.')) t.className = labFlag(t.name.slice(5), t.value);
});
document.addEventListener('change', (ev) => {
  const t = ev.target;
  if (t.id === 'filter') { settings.filter = t.value; saveSettings(); render(); }
  if (t.classList.contains('psec')) {
    settings.printSections = [...document.querySelectorAll('.psec:checked')].map((x) => x.value); saveSettings();
    const p = getP(route().parts[1]); $('#report').innerHTML = reportHTML(p, settings.printSections);
  }
  if (t.id === 'importFile' && t.files[0]) importBackup(t.files[0]);
  if (t.closest('#assessForm')) updateAssessLive();
  if (t.closest('#pymsForm')) updatePymsLive(false);
  if (t.closest('#regimenForm') || t.closest('#fuForm')) updateRegimenLive();
});

document.addEventListener('submit', async (ev) => {
  const form = ev.target; ev.preventDefault();
  const d = readForm(form);
  if (form.id === 'loginForm') {
    const act = ev.submitter?.value || 'in';
    try { act === 'up' ? await store.signUp(d.email, d.password) : await store.signIn(d.email, d.password); }
    catch (e) { alert(e.message.replace('Firebase: ', '')); }
    return;
  }
  if (form.id === 'settingsForm') { Object.assign(settings, d); saveSettings(); toast('Settings saved'); return; }
  if (form.id === 'patientForm') {
    const p = form.dataset.new ? blankPatient() : JSON.parse(JSON.stringify(getP(form.dataset.id)));
    if (form.dataset.new) p.id = form.dataset.id;
    Object.assign(p, d); savePatient(p, 'Patient saved'); go(`#/p/${p.id}`); return;
  }
  const pid = form.dataset.pid; if (!pid) return;
  const p = JSON.parse(JSON.stringify(getP(pid)));
  const upsert = (key, item) => { p[key] = p[key] || []; const i = p[key].findIndex((x) => x.id === item.id); if (i >= 0) p[key][i] = { ...p[key][i], ...item }; else p[key].push(item); };
  if (form.id === 'assessForm') {
    const old = (p.assessments || []).find((x) => x.id === form.dataset.aid);
    const prev = latest(p.assessments);
    d.id = form.dataset.aid; d.regimen = old?.regimen || prev?.regimen || { items: [] };
    upsert('assessments', d); savePatient(p, 'Assessment saved'); go(`#/p/${pid}/assessment/${d.id}`);
  } else if (form.id === 'regimenForm') {
    const a = p.assessments.find((x) => x.id === form.dataset.aid);
    a.regimen = { ...d.regimen, items: normItems(d.regimen?.items) };
    savePatient(p, 'Regimen saved'); render();
  } else if (form.id === 'measForm') {
    d.id = newId(); upsert('measurements', d); savePatient(p, 'Measurement added'); render();
  } else if (form.id === 'pymsForm') {
    d.id = form.dataset.eid; ['s1', 's2', 's3', 's4'].forEach((k) => { d[k] = +d[k] || 0; });
    upsert('pyms', d); savePatient(p, 'PYMS saved'); go(`#/p/${pid}/pyms`);
  } else if (form.id === 'fuForm') {
    d.id = form.dataset.fid; d.regimen = { items: normItems(d.regimen?.items) };
    upsert('followUps', d); savePatient(p, 'Follow-up saved'); go(`#/p/${pid}/followup`);
  } else if (form.id === 'dischargeForm') {
    const mark = d.markDischarged; delete d.markDischarged;
    p.discharge = d; p.status = mark ? 'discharged' : 'active';
    savePatient(p, 'Discharge summary saved'); render();
  }
});

const actions = {
  signout: () => store.signOut(),
  reset: async () => { const email = prompt('Enter your email to reset the password:'); if (email) { try { await store.reset(email); alert('Reset email sent.'); } catch (e) { alert(e.message); } } },
  deletePatient: (el) => {
    const p = getP(el.dataset.id);
    if (!confirm(`Delete the whole file of "${p.name}"? This cannot be undone.`)) return;
    state.patients = state.patients.filter((x) => x.id !== p.id);
    store.remove(p.id).catch((e) => alert(e.message)); go('#/');
  },
  deleteItem: (el) => {
    if (!confirm('Delete this entry?')) return;
    const p = JSON.parse(JSON.stringify(getP(el.dataset.pid)));
    p[el.dataset.kind] = (p[el.dataset.kind] || []).filter((x) => x.id !== el.dataset.iid);
    savePatient(p, 'Deleted');
    go(`#/p/${p.id}/${{ assessments: 'assessment', pyms: 'pyms', followUps: 'followup' }[el.dataset.kind]}`);
  },
  addRegRow: () => { $('#regRows').insertAdjacentHTML('beforeend', regimenRow()); },
  rmRow: (el) => { el.closest('.regrow').remove(); updateRegimenLive(); },
  useFormula: (el) => {
    const rows = $('#regRows'); rows.innerHTML = regimenRow({ id: el.dataset.fid, servings: +el.dataset.serv });
    updateRegimenLive(); $('#regimenForm').scrollIntoView({ behavior: 'smooth' });
  },
  fillPlan: (el) => {
    const p = getP(el.dataset.pid); const la = latest(p.assessments); const ta = $('textarea[name="formulaPlan"]');
    const it = la?.regimen?.items || [];
    ta.value = it.map((i) => { const f = formulaById(i.id); if (!f) return ''; const n = +i.servings || 0;
      return `${f.name}: ${fmt(n)} servings/day${f.scoops ? ` (${f.scoops} scoops in ${f.volume} mL water each = ${fmt(f.scoops * n, 0)} scoops/day)` : ''} → ${fmt(f.kcal * n, 0)} kcal, ${fmt(f.protein * n)} g protein`; }).filter(Boolean).join('\n') || ta.value;
  },
  print: () => window.print(),
  export: () => {
    const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), patients: state.patients }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `nutrition-backup-${today()}.json`; a.click();
  },
};
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]'); if (!el) return;
  ev.preventDefault(); actions[el.dataset.action]?.(el);
});
async function importBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    const list = data.patients || [];
    if (!confirm(`Import ${list.length} patient file(s)? Files with the same ID will be replaced.`)) return;
    for (const p of list) await store.save(p);
    toast('Imported'); render();
  } catch (e) { alert('Import failed: ' + e.message); }
}

// =====================================================================
//  START
// =====================================================================
let unsub = null;
store.init((user) => {
  state.user = user; state.ready = true;
  if (unsub) unsub();
  unsub = store.subscribe((list) => {
    state.patients = list;
    if (!state.dirty) render();
  });
  render();
}).catch((e) => { state.ready = true; $('#app').innerHTML = `<div class="card bad">Could not start: ${h(e.message)}</div>`; });

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch {}
}
