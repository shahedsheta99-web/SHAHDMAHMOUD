// =====================================================================
//  tracker.js — My Nutrition: plans, daily tracker, scanners,
//  recommendations and history. Everything is saved on this device
//  (browser storage) — use Settings → Backup to move it to another device.
// =====================================================================
import { FOODS, REGION_LABEL } from './foods.js';
import { scanBarcode, lookupBarcode, imageToBase64, analyzeMeal, aiErrorMessage } from './scanner.js';

// ---------------- helpers ----------------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r0 = (x) => Math.round(+x || 0);
const r1 = (x) => Math.round((+x || 0) * 10) / 10;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const iso = (d) => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 10); };
const todayISO = () => iso(new Date());
const addDays = (s, n) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + n); return iso(d); };
const niceDate = (s) => new Date(s + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}
function confirmBox(msg, ok = 'Delete') {
  return new Promise((res) => {
    const d = document.createElement('div'); d.className = 'modal';
    d.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true"><p>${h(msg)}</p><div class="row gap"><button class="btn danger" data-ok>${h(ok)}</button><button class="btn ghost" data-no>Cancel</button></div></div>`;
    document.body.append(d);
    d.addEventListener('click', (e) => {
      if (e.target.closest('[data-ok]')) { d.remove(); res(true); }
      else if (e.target.closest('[data-no]') || e.target === d) { d.remove(); res(false); }
    });
  });
}

// ---------------- data ----------------
const KEY = 'nt_data_v1';
const MEALS = [
  ['breakfast', 'Breakfast', 'فطار', 'b'],
  ['lunch', 'Lunch', 'غدا', 'l'],
  ['dinner', 'Dinner', 'عشا', 'd'],
  ['snacks', 'Snacks', 'سناكس', 's'],
];
const blank = () => ({
  profile: { sex: 'female', age: 28, height: 165, weight: 70, activity: 1.375, goal: 'lose', rate: 0.5 },
  plans: [], activePlanId: null, log: {}, customFoods: [], favorites: [], recent: [],
  settings: { apiKey: '', waterGoal: 8 },
});
let db = (() => { try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return blank(); } })();
db.settings = Object.assign(blank().settings, db.settings || {});
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { alert('Could not save on this device: ' + e.message); }
}

const allFoods = () => [...db.customFoods, ...FOODS];
const foodById = (id) => allFoods().find((f) => f.id === id);
const activePlan = () => db.plans.find((p) => p.id === db.activePlanId) || db.plans[0] || null;
const dayLog = (d) => (db.log[d] ||= { meals: { breakfast: [], lunch: [], dinner: [], snacks: [] }, water: 0 });
const snap = (f) => ({ id: f.id, name: f.name, ar: f.ar || '', serving: f.serving, g: f.g, kcal: f.kcal, p: f.p, c: f.c, f: f.f });

function totals(entries) {
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const e of entries) { t.kcal += e.food.kcal * e.qty; t.p += e.food.p * e.qty; t.c += e.food.c * e.qty; t.f += e.food.f * e.qty; }
  return t;
}
const dayTotals = (d) => { const L = db.log[d]; return L ? totals(Object.values(L.meals).flat()) : { kcal: 0, p: 0, c: 0, f: 0 }; };
const dayHasFood = (d) => db.log[d] && Object.values(db.log[d].meals).some((a) => a.length);

function addEntry(date, meal, food, qty = 1) {
  const L = dayLog(date);
  L.meals[meal].push({ id: uid(), food: snap(food), qty: +qty || 1 });
  db.recent = [food.id, ...db.recent.filter((x) => x !== food.id)].slice(0, 30);
  // keep scanned products so they can be found again in search
  if (food.id.startsWith('bc-') && !db.customFoods.some((x) => x.id === food.id)) db.customFoods.unshift({ ...food });
  save();
}

// ---------------- energy & plan maths ----------------
const ACTIVITY = [
  [1.2, 'Sedentary (desk job, little exercise)'],
  [1.375, 'Lightly active (exercise 1–3 days/week)'],
  [1.55, 'Moderately active (3–5 days/week)'],
  [1.725, 'Very active (6–7 days/week)'],
  [1.9, 'Athlete / physical job + training'],
];
const SPLITS = {
  balanced: ['Balanced', 25, 50, 25],
  highprotein: ['High protein', 35, 40, 25],
  lowcarb: ['Low carb', 30, 25, 45],
  keto: ['Keto', 25, 5, 70],
  mediterranean: ['Mediterranean', 20, 50, 30],
  endurance: ['Endurance / sport', 20, 60, 20],
  custom: ['Custom', 30, 40, 30],
};
const MEAL_SHARE = {
  3: { breakfast: 0.3, lunch: 0.4, dinner: 0.3, snacks: 0 },
  4: { breakfast: 0.25, lunch: 0.35, dinner: 0.25, snacks: 0.15 },
  5: { breakfast: 0.22, lunch: 0.32, dinner: 0.24, snacks: 0.22 },
};

function bmr({ sex, age, height, weight }) {
  return 10 * weight + 6.25 * height - 5 * age + (sex === 'male' ? 5 : -161);
}
function calcTarget(pr) {
  const b = bmr(pr), tdee = b * (+pr.activity || 1.2);
  let kcal = tdee;
  const perDay = (+pr.rate || 0) * 7700 / 7;
  if (pr.goal === 'lose') kcal = tdee - perDay;
  if (pr.goal === 'gain') kcal = tdee + perDay;
  const floor = pr.sex === 'male' ? 1500 : 1200;
  const warn = kcal < floor ? `This is below the usual safe minimum (${floor} kcal). It was raised to ${floor}.` : '';
  kcal = Math.max(kcal, floor);
  return { bmr: r0(b), tdee: r0(tdee), kcal: Math.round(kcal / 10) * 10, warn };
}
function macroGrams(kcal, pP, cP, fP) {
  return { p: r0(kcal * pP / 100 / 4), c: r0(kcal * cP / 100 / 4), f: r0(kcal * fP / 100 / 9) };
}

// ---------------- meal plan generator ----------------
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const regionOK = (f, cuisine) => cuisine === 'mixed' || f.region === 'basic' || f.region === cuisine;
const MAIN_EXCLUDE = new Set(['Sweets', 'Fats & oils', 'Drinks', 'Egyptian desserts', 'Fruits', 'Vegetables', 'Nuts & snacks', 'Egyptian salads', 'Bread']);
const SIDE_CATS = new Set(['Vegetables', 'Egyptian salads', 'Fruits', 'Dairy', 'Bread', 'Grains', 'Salads']);
const SNACK_CATS = new Set(['Fruits', 'Nuts & snacks', 'Dairy', 'Healthy', 'Egyptian snacks', 'Proteins']);

function buildMeal(meal, target, plan, rand, avoid) {
  const tag = MEALS.find((m) => m[0] === meal)[3];
  const pool = allFoods().filter((f) => f.meals.includes(tag) && regionOK(f, plan.cuisine) && f.kcal > 0 && !avoid.has(f.id));
  const items = [];
  if (target < 60) return items;
  const proteinRatio = plan.p * 4 / plan.kcal; // share of kcal from protein wanted
  const carbRatio = plan.c * 4 / plan.kcal;
  const lowCarb = carbRatio < 0.3;
  const carbOK = (f) => !lowCarb || (f.c * 4 / Math.max(f.kcal, 1)) < carbRatio + 0.15;
  if (meal === 'snacks') {
    const snacks = pool.filter((f) => SNACK_CATS.has(f.cat) && f.kcal <= target * 1.2 && carbOK(f))
      .sort((a, b) => (b.p / b.kcal) - (a.p / a.kcal) + (rand() - 0.5) * 0.15);
    if (proteinRatio > 0.25) snacks.splice(12);
    let left = target;
    for (let i = 0; i < 3 && left > 60 && snacks.length; i++) {
      const pick = snacks.splice(Math.floor(rand() * snacks.length), 1)[0];
      const q = Math.max(0.5, Math.min(2, Math.round((left / (3 - i) / pick.kcal) * 2) / 2));
      if (pick.kcal * q > left + 60) continue;
      items.push({ food: snap(pick), qty: q }); left -= pick.kcal * q; avoid.add(pick.id);
    }
    return items;
  }
  // main dish: scored by protein share close to the plan and portion fit
  const mains = pool.filter((f) => !MAIN_EXCLUDE.has(f.cat) && f.kcal >= 120 && carbOK(f))
    .map((f) => {
      const pr = f.p * 4 / f.kcal, cr = f.c * 4 / f.kcal;
      const q = Math.max(0.5, Math.min(3, Math.round((target * 0.7 / f.kcal) * 2) / 2));
      const fit = Math.abs(f.kcal * q - target * 0.7) / target;
      // too little protein is penalised more than a bit too much
      return { f, q, score: Math.max(0, proteinRatio - pr) * 5 + Math.max(0, pr - proteinRatio) + Math.abs(cr - carbRatio) * 2 + fit + rand() * 0.5 };
    })
    .sort((a, b) => a.score - b.score).slice(0, 10);
  if (!mains.length) return items;
  const m = mains[Math.floor(rand() * mains.length)];
  items.push({ food: snap(m.f), qty: m.q }); avoid.add(m.f.id);
  let left = target - m.f.kcal * m.q;
  // if the meal is still short on protein, add a lean protein side first
  const mealP = m.f.p * m.q;
  if (left > 80 && mealP * 4 < target * proteinRatio * 0.8) {
    const lean = pool.filter((f) => (f.cat === 'Proteins' || f.cat === 'Dairy' || f.cat === 'Legumes') && f.p * 4 / f.kcal > 0.3 && f.kcal <= left && f.id !== m.f.id);
    if (lean.length) {
      const s = lean[Math.floor(rand() * Math.min(lean.length, 6))];
      const q = Math.max(0.5, Math.min(2, Math.round(((target * proteinRatio - mealP * 4) / 4 / s.p) * 2) / 2));
      if (s.kcal * q <= left + 40) { items.push({ food: snap(s), qty: q }); left -= s.kcal * q; avoid.add(s.id); }
    }
  }
  const sides = pool.filter((f) => SIDE_CATS.has(f.cat) && f.id !== m.f.id && !avoid.has(f.id) && carbOK(f));
  for (let i = 0; i < 2 && left > 50 && sides.length; i++) {
    const s = sides.splice(Math.floor(rand() * sides.length), 1)[0];
    const q = Math.max(0.5, Math.min(2, Math.round((left / s.kcal) * 2) / 2));
    if (s.kcal * q > left + 80) continue;
    items.push({ food: snap(s), qty: q }); left -= s.kcal * q;
  }
  return items;
}
function generateMealPlan(plan, seed = Date.now()) {
  const rand = rng(seed), share = MEAL_SHARE[plan.mealsPerDay] || MEAL_SHARE[4], out = {}, avoid = new Set();
  for (const [m] of MEALS) out[m] = buildMeal(m, plan.kcal * share[m], plan, rand, avoid);
  return out;
}

// ---------------- rendering shell ----------------
const app = $('#app');
const state = { date: todayISO(), addMeal: null };
function route() {
  const [, page = 'today', a] = location.hash.split('/');
  $$('.tnav a').forEach((x) => x.classList.toggle('on', x.dataset.p === page));
  const view = { today: viewToday, plans: viewPlans, plan: () => viewPlanEdit(a), recommend: viewRecommend, history: viewHistory, foods: viewFoods, settings: viewSettings }[page] || viewToday;
  view();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

// ring + bars
function ring(eaten, target) {
  const pct = target ? Math.min(eaten / target, 1.5) : 0;
  const R = 52, C = 2 * Math.PI * R, over = eaten > target;
  return `<svg viewBox="0 0 130 130" class="ring" role="img" aria-label="${r0(eaten)} of ${r0(target)} kcal">
    <circle cx="65" cy="65" r="${R}" class="ring-bg"/>
    <circle cx="65" cy="65" r="${R}" class="ring-fg ${over ? 'over' : ''}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - Math.min(pct, 1))}" transform="rotate(-90 65 65)"/>
    <text x="65" y="62" class="ring-big">${r0(Math.abs(target - eaten))}</text>
    <text x="65" y="82" class="ring-sm">${over ? 'kcal over' : 'kcal left'}</text></svg>`;
}
function bar(label, val, target, cls) {
  const pct = target ? Math.min(100, (val / target) * 100) : 0;
  return `<div class="mbar"><div class="row between"><span>${label}</span><span class="muted small">${r0(val)} / ${r0(target)} g</span></div>
    <div class="track"><div class="fill ${cls} ${val > target * 1.1 ? 'over' : ''}" style="width:${pct}%"></div></div></div>`;
}
const macroLine = (t) => `${r0(t.kcal)} kcal · P ${r0(t.p)} · C ${r0(t.c)} · F ${r0(t.f)}`;

function targetsFor() {
  const p = activePlan();
  return p ? p : { kcal: 2000, p: 100, c: 250, f: 67, name: 'Default (no plan yet)', mealsPerDay: 4 };
}

// ---------------- TODAY ----------------
function viewToday() {
  const d = state.date, L = dayLog(d), T = targetsFor(), t = dayTotals(d), plan = activePlan();
  const isToday = d === todayISO();
  app.innerHTML = `
  <div class="datebar">
    <button class="btn ghost sm" data-day="-1" aria-label="Previous day">‹</button>
    <label class="datepick"><b>${isToday ? 'Today' : niceDate(d)}</b> <input type="date" id="dpick" value="${d}"></label>
    <button class="btn ghost sm" data-day="1" aria-label="Next day">›</button>
    ${isToday ? '' : '<button class="btn ghost sm" data-today>Today</button>'}
  </div>
  ${plan ? '' : `<div class="alert warn">You have no nutrition plan yet. <a href="#/plan/new">Create your plan</a> to get your personal calorie target.</div>`}
  <div class="card summary">
    ${ring(t.kcal, T.kcal)}
    <div class="sumright">
      <div class="small muted">Plan: <b>${h(T.name)}</b> · target ${r0(T.kcal)} kcal · eaten ${r0(t.kcal)}</div>
      ${bar('Protein', t.p, T.p, 'cp')}
      ${bar('Carbs', t.c, T.c, 'cc')}
      ${bar('Fat', t.f, T.f, 'cf')}
    </div>
  </div>
  <div class="card water">
    <div class="row between"><b>💧 Water</b><span class="muted small">${L.water} / ${db.settings.waterGoal} glasses</span></div>
    <div class="glasses">${Array.from({ length: Math.max(db.settings.waterGoal, L.water) }, (_, i) => `<button class="glass ${i < L.water ? 'on' : ''}" data-water="${i + 1}" aria-label="${i + 1} glasses"></button>`).join('')}</div>
  </div>
  <div class="quick row gap wrap">
    <button class="btn sm" data-scan="photo">📷 AI meal scan</button>
    <button class="btn sm ghost" data-scan="barcode">▥ Scan barcode</button>
    <button class="btn sm ghost" data-copy>Copy yesterday</button>
    ${plan ? '<button class="btn sm ghost" data-logplan>Log my plan\'s menu</button>' : ''}
  </div>
  ${MEALS.map(([k, label, ar]) => {
    const items = L.meals[k], mt = totals(items);
    const share = (MEAL_SHARE[T.mealsPerDay] || MEAL_SHARE[4])[k];
    return `<section class="card meal">
      <div class="row between"><h3>${label} <span class="muted small" dir="rtl">${ar}</span></h3>
        <span class="small muted">${r0(mt.kcal)}${share ? ' / ~' + r0(T.kcal * share) : ''} kcal</span></div>
      ${items.length ? `<ul class="entries">${items.map((e) => `<li>
          <div class="en-main"><b>${h(e.food.name)}</b>${e.food.ar ? ` <span class="muted small" dir="rtl">${h(e.food.ar)}</span>` : ''}
          <div class="small muted">${r1(e.qty)} × ${h(e.food.serving)} · P ${r1(e.food.p * e.qty)} · C ${r1(e.food.c * e.qty)} · F ${r1(e.food.f * e.qty)}</div></div>
          <div class="en-qty"><button class="qbtn" data-q="-0.5" data-e="${e.id}" data-m="${k}" aria-label="Less">−</button><span>${r0(e.food.kcal * e.qty)}</span><button class="qbtn" data-q="0.5" data-e="${e.id}" data-m="${k}" aria-label="More">+</button></div>
          <button class="x" data-del="${e.id}" data-m="${k}" aria-label="Remove">×</button></li>`).join('')}</ul>` : '<p class="muted small empty">Nothing logged yet.</p>'}
      <button class="btn ghost sm" data-add="${k}">+ Add food</button>
    </section>`;
  }).join('')}
  <div class="card"><label class="fld"><span>Today's weight <em>kg (optional)</em></span>
    <input type="number" step="0.1" inputmode="decimal" id="wt" value="${L.weight ?? ''}" placeholder="e.g. ${db.profile.weight}"></label>
    <label class="fld"><span>Notes</span><textarea id="notes" rows="2" dir="auto" placeholder="How did today go?">${h(L.notes || '')}</textarea></label></div>`;

  app.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.day) { state.date = addDays(d, +b.dataset.day); return viewToday(); }
    if ('today' in b.dataset) { state.date = todayISO(); return viewToday(); }
    if (b.dataset.water) { const n = +b.dataset.water; L.water = L.water === n ? n - 1 : n; save(); return viewToday(); }
    if (b.dataset.add) return openAdd(b.dataset.add);
    if (b.dataset.scan) return openAdd(guessMeal(), b.dataset.scan);
    if (b.dataset.del) { L.meals[b.dataset.m] = L.meals[b.dataset.m].filter((x) => x.id !== b.dataset.del); save(); return viewToday(); }
    if (b.dataset.q) {
      const en = L.meals[b.dataset.m].find((x) => x.id === b.dataset.e);
      en.qty = Math.max(0.25, r1(en.qty + +b.dataset.q)); save(); return viewToday();
    }
    if ('copy' in b.dataset) {
      const y = db.log[addDays(d, -1)];
      if (!y || !Object.values(y.meals).some((a) => a.length)) return toast('Nothing logged yesterday.');
      for (const [m] of MEALS) L.meals[m].push(...y.meals[m].map((x) => ({ ...x, id: uid() })));
      save(); toast('Copied yesterday\'s meals'); return viewToday();
    }
    if ('logplan' in b.dataset) {
      if (!plan.mealPlan) return toast('This plan has no menu yet. Open it in Plans.');
      for (const [m] of MEALS) L.meals[m].push(...(plan.mealPlan[m] || []).map((x) => ({ id: uid(), food: { ...x.food }, qty: x.qty })));
      save(); toast('Your plan\'s menu was added — edit anything you changed'); return viewToday();
    }
  };
  $('#dpick').onchange = (e) => { if (e.target.value) { state.date = e.target.value; viewToday(); } };
  $('#wt').onchange = (e) => { const v = e.target.value; if (v === '') delete L.weight; else { L.weight = +v; db.profile.weight = +v; } save(); toast('Weight saved'); };
  $('#notes').onchange = (e) => { L.notes = e.target.value; save(); };
}
function guessMeal() {
  const hr = new Date().getHours();
  return hr < 11 ? 'breakfast' : hr < 16 ? 'lunch' : hr < 21 ? 'dinner' : 'snacks';
}

// ---------------- ADD FOOD sheet ----------------
function sheet(html) {
  const d = document.createElement('div'); d.className = 'sheet-wrap';
  d.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><button class="x sheet-x" data-close aria-label="Close">×</button>${html}</div>`;
  document.body.append(d); document.body.classList.add('noscroll');
  const close = () => { d.dispatchEvent(new Event('closing')); d.remove(); document.body.classList.remove('noscroll'); };
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) close(); });
  return { el: d.firstElementChild, wrap: d, close };
}

function foodRow(f, extra = '') {
  return `<li class="frow" data-f="${h(f.id)}">
    <div class="f-main"><b>${h(f.name)}</b>${f.ar ? ` <span class="muted small" dir="rtl">${h(f.ar)}</span>` : ''}
      <div class="small muted">${h(f.serving)}${f.g ? ` (${r0(f.g)} g)` : ''} · P ${r1(f.p)} · C ${r1(f.c)} · F ${r1(f.f)} ${f.region && f.region !== 'basic' ? `<span class="tag ${f.region}">${REGION_LABEL[f.region]}</span>` : ''}${extra}</div></div>
    <div class="f-kcal"><b>${r0(f.kcal)}</b><small>kcal</small></div>
    <button class="btn sm" data-pick="${h(f.id)}" aria-label="Add ${h(f.name)}">+</button></li>`;
}

function searchFoods(q, region = 'all', limit = 60) {
  const s = q.trim().toLowerCase();
  let list = allFoods();
  if (region !== 'all') list = list.filter((f) => f.region === region || (region === 'custom' && (f.id.startsWith('c-') || f.id.startsWith('bc-'))));
  if (!s) return list.slice(0, limit);
  const words = s.split(/\s+/);
  return list.map((f) => {
    const hay = (f.name + ' ' + (f.ar || '') + ' ' + f.cat).toLowerCase();
    if (!words.every((w) => hay.includes(w))) return null;
    return { f, score: (f.name.toLowerCase().startsWith(s) ? 0 : 1) + (hay.indexOf(words[0]) / 100) };
  }).filter(Boolean).sort((a, b) => a.score - b.score).slice(0, limit).map((x) => x.f);
}

function openAdd(meal, mode = 'search') {
  const label = MEALS.find((m) => m[0] === meal)[1];
  const S = sheet(`
    <h3>Add to <select id="addMeal" class="inline-sel">${MEALS.map(([k, l]) => `<option value="${k}" ${k === meal ? 'selected' : ''}>${l}</option>`).join('')}</select></h3>
    <div class="tabs" id="addTabs">
      <a href="#" data-t="search">Search</a><a href="#" data-t="photo">📷 AI scan</a><a href="#" data-t="barcode">▥ Barcode</a>
      <a href="#" data-t="recent">Recent & ★</a><a href="#" data-t="custom">Custom</a>
    </div>
    <div id="addBody"></div>`);
  let cleanup = () => {};
  S.wrap.addEventListener('closing', () => cleanup());
  const body = $('#addBody', S.el);
  const curMeal = () => $('#addMeal', S.el).value;
  const added = (f, qty) => { addEntry(state.date, curMeal(), f, qty); toast(`Added ${f.name}`); if (location.hash.startsWith('#/today') || location.hash === '' || location.hash === '#/') viewToday(); };

  // quantity picker for a food
  function pickQty(f) {
    const Q = sheet(`<h3>${h(f.name)}</h3>${f.ar ? `<p class="muted" dir="rtl">${h(f.ar)}</p>` : ''}
      <p class="small muted">1 serving = ${h(f.serving)}${f.g ? ` (${r0(f.g)} g)` : ''}</p>
      <div class="g2"><label class="fld"><span>Servings</span><input type="number" id="qs" value="1" step="0.25" min="0.25" inputmode="decimal"></label>
      <label class="fld"><span>or grams</span><input type="number" id="qg" value="${r0(f.g || 100)}" step="5" inputmode="decimal"></label></div>
      <div class="qchips">${[0.5, 1, 1.5, 2, 3].map((x) => `<button class="chip" data-x="${x}">${x}×</button>`).join('')}</div>
      <div class="needs" id="qprev"></div>
      <div class="row gap"><button class="btn" id="qok">Add to ${h(MEALS.find((m) => m[0] === curMeal())[1])}</button>
      <button class="btn ghost" id="qfav">${db.favorites.includes(f.id) ? '★ Favorite' : '☆ Favorite'}</button></div>`);
    const qs = $('#qs', Q.el), qg = $('#qg', Q.el);
    const prev = () => { const q = +qs.value || 0; $('#qprev', Q.el).innerHTML = `<div class="need"><span>kcal</span><b>${r0(f.kcal * q)}</b></div><div class="need"><span>Protein</span><b>${r1(f.p * q)}</b><em>g</em></div><div class="need"><span>Carbs / Fat</span><b>${r0(f.c * q)}/${r0(f.f * q)}</b><em>g</em></div>`; };
    qs.oninput = () => { qg.value = r0((+qs.value || 0) * (f.g || 100)); prev(); };
    qg.oninput = () => { qs.value = Math.round((+qg.value || 0) / (f.g || 100) * 100) / 100; prev(); };
    Q.el.addEventListener('click', (e) => {
      const c = e.target.closest('[data-x]'); if (c) { qs.value = c.dataset.x; qs.oninput(); }
    });
    $('#qok', Q.el).onclick = () => { const q = +qs.value; if (!q) return; added(f, q); Q.close(); };
    $('#qfav', Q.el).onclick = (e) => {
      db.favorites = db.favorites.includes(f.id) ? db.favorites.filter((x) => x !== f.id) : [f.id, ...db.favorites];
      if (f.id.startsWith('ai-') && !db.customFoods.some((x) => x.id === f.id)) db.customFoods.unshift({ ...f, meals: 'blds', region: 'basic', cat: 'My foods' });
      save(); e.target.textContent = db.favorites.includes(f.id) ? '★ Favorite' : '☆ Favorite';
    };
    prev();
  }
  body.addEventListener('click', (e) => {
    const p = e.target.closest('[data-pick]');
    if (p) { const f = foodById(p.dataset.pick) || body._extra?.[p.dataset.pick]; if (f) pickQty(f); }
  });

  const tabs = {
    search() {
      body.innerHTML = `<div class="toolbar"><input id="q" type="search" placeholder="Search: koshari, كشري, chicken, pizza…" autocomplete="off" dir="auto">
        <select id="reg"><option value="all">All</option><option value="eg">Egyptian</option><option value="intl">International</option><option value="basic">Basic</option><option value="custom">My foods</option></select></div>
        <ul class="flist" id="res"></ul>`;
      const run = () => {
        const list = searchFoods($('#q', body).value, $('#reg', body).value);
        $('#res', body).innerHTML = list.length ? list.map((f) => foodRow(f)).join('') : '<li class="muted">No match. Try the AI scan, or add it under Custom.</li>';
      };
      $('#q', body).oninput = run; $('#reg', body).onchange = run; run();
      setTimeout(() => $('#q', body)?.focus(), 50);
    },
    recent() {
      const fav = db.favorites.map(foodById).filter(Boolean), rec = db.recent.map(foodById).filter(Boolean).filter((f) => !db.favorites.includes(f.id));
      body.innerHTML = `<h4>★ Favorites</h4><ul class="flist">${fav.map((f) => foodRow(f)).join('') || '<li class="muted small">Tap ☆ Favorite when adding a food.</li>'}</ul>
        <h4>Recently eaten</h4><ul class="flist">${rec.map((f) => foodRow(f)).join('') || '<li class="muted small">Nothing yet.</li>'}</ul>`;
    },
    custom() {
      body.innerHTML = customFoodForm();
      $('#cf', body).onsubmit = (e) => {
        e.preventDefault(); const f = readCustom(e.target); db.customFoods.unshift(f); save();
        toast('Saved to My foods'); pickQty(f); e.target.reset();
      };
    },
    barcode() {
      body.innerHTML = `<p class="small muted">Point the camera at the barcode of a packaged product. Data from Open Food Facts.</p>
        <div class="cam"><video id="vid" playsinline muted></video><div class="cam-line"></div></div>
        <p id="bcStatus" class="small">Starting camera…</p>
        <form id="bcManual" class="row gap"><input id="bcCode" inputmode="numeric" placeholder="or type the barcode number"><button class="btn sm">Look up</button></form>
        <ul class="flist" id="bcRes"></ul>`;
      const status = (m) => { const s = $('#bcStatus', body); if (s) s.textContent = m; };
      const found = async (code) => {
        status(`Barcode ${code} — looking it up…`);
        try {
          const local = db.customFoods.find((x) => x.barcode === code);
          const f = local || await lookupBarcode(code);
          if (!f) { status(`Product ${code} was not found. Add it under Custom.`); return; }
          body._extra = { [f.id]: f };
          $('#bcRes', body).innerHTML = foodRow(f);
          status('Found it. Tap + to add.');
          pickQty(f);
        } catch { status('Could not reach the product database. Check your internet.'); }
      };
      $('#bcManual', body).onsubmit = (e) => { e.preventDefault(); const c = $('#bcCode', body).value.trim(); if (c) found(c); };
      if (!navigator.mediaDevices?.getUserMedia) { status('Camera is not available here. Type the barcode instead.'); return; }
      const sc = scanBarcode($('#vid', body));
      cleanup = sc.stop;
      sc.promise.then((code) => { status(''); found(code); })
        .catch((err) => { if (err.message !== 'stopped') status('Camera could not start (' + (err.name || err.message) + '). Allow camera access, or type the barcode.'); });
      status('Hold the barcode inside the frame.');
    },
    photo() {
      const hasKey = !!db.settings.apiKey;
      body.innerHTML = `
        ${hasKey ? '' : `<div class="alert warn">The AI scanner needs your own Anthropic API key. <a href="#/settings" data-close>Add it in Settings</a>. Until then, use Search or Barcode.</div>`}
        <p class="small muted">Take a photo of your plate (or choose one), and/or describe it. The AI lists each food with estimated grams and calories — check and adjust before adding.</p>
        <label class="photo-drop"><input type="file" accept="image/*" capture="environment" id="ph" hidden>
          <span id="phLabel">📷 Take or choose a photo</span><img id="phPrev" alt="" hidden></label>
        <label class="fld"><span>Description (optional)</span><input id="phTxt" dir="auto" placeholder="e.g. 2 ta'ameya sandwiches and tea with 2 sugars"></label>
        <button class="btn" id="phGo" ${hasKey ? '' : 'disabled'}>Analyse meal</button>
        <div id="phOut"></div>`;
      let file = null;
      $('#ph', body).onchange = (e) => {
        file = e.target.files[0]; if (!file) return;
        const img = $('#phPrev', body); img.src = URL.createObjectURL(file); img.hidden = false; $('#phLabel', body).textContent = 'Change photo';
      };
      $('#phGo', body).onclick = async () => {
        const text = $('#phTxt', body).value.trim();
        if (!file && !text) return toast('Add a photo or a description');
        const out = $('#phOut', body), btn = $('#phGo', body);
        btn.disabled = true; out.innerHTML = '<p class="muted"><span class="spin"></span> Analysing your meal…</p>';
        try {
          const imageB64 = file ? await imageToBase64(file) : null;
          const res = await analyzeMeal({ apiKey: db.settings.apiKey, imageB64, text });
          showAI(res, out);
        } catch (err) { out.innerHTML = `<div class="alert bad">${h(aiErrorMessage(err))}</div>`; }
        btn.disabled = false;
      };
    },
  };
  function showAI(res, out) {
    if (!res.items?.length) { out.innerHTML = `<div class="alert warn">${h(res.note || 'No food found.')}</div>`; return; }
    const items = res.items.map((it) => ({ ...it, on: true }));
    const draw = () => {
      const t = items.filter((x) => x.on).reduce((a, x) => ({ kcal: a.kcal + x.kcal, p: a.p + x.protein, c: a.c + x.carbs, f: a.f + x.fat }), { kcal: 0, p: 0, c: 0, f: 0 });
      out.innerHTML = `<p class="small muted">${h(res.note || '')}</p>
        <ul class="flist ai">${items.map((x, i) => `<li class="frow">
          <label class="chk"><input type="checkbox" data-on="${i}" ${x.on ? 'checked' : ''}></label>
          <div class="f-main"><b>${h(x.name)}</b> <span class="muted small" dir="rtl">${h(x.name_ar)}</span>
          <div class="small muted">P ${r1(x.protein)} · C ${r1(x.carbs)} · F ${r1(x.fat)} · <span class="tag ${x.confidence}">${x.confidence} confidence</span></div></div>
          <label class="gram"><input type="number" value="${r0(x.grams)}" data-g="${i}" inputmode="decimal"><small>g</small></label>
          <div class="f-kcal"><b>${r0(x.kcal)}</b><small>kcal</small></div></li>`).join('')}</ul>
        <div class="row between"><b>Total: ${macroLine(t)}</b><button class="btn" id="aiAdd">Add selected</button></div>`;
    };
    draw();
    out.onchange = (e) => {
      const on = e.target.dataset.on, g = e.target.dataset.g;
      if (on != null) items[on].on = e.target.checked;
      if (g != null) { // rescale macros to the new weight
        const x = items[g], k = (+e.target.value || 0) / (x.grams || 1);
        Object.assign(x, { grams: +e.target.value || 0, kcal: x.kcal * k, protein: x.protein * k, carbs: x.carbs * k, fat: x.fat * k });
      }
      draw();
    };
    out.onclick = (e) => {
      if (e.target.id !== 'aiAdd') return;
      const sel = items.filter((x) => x.on);
      for (const x of sel) {
        const f = { id: 'ai-' + uid(), name: x.name, ar: x.name_ar, serving: `${r0(x.grams)} g (AI estimate)`, g: r0(x.grams), kcal: r0(x.kcal), p: r1(x.protein), c: r1(x.carbs), f: r1(x.fat), meals: 'blds' };
        addEntry(state.date, curMeal(), f, 1);
      }
      toast(`Added ${sel.length} item${sel.length === 1 ? '' : 's'}`); S.close(); viewToday();
    };
  }
  const tabBar = $('#addTabs', S.el);
  const go = (t) => { cleanup(); cleanup = () => {}; $$('a', tabBar).forEach((a) => a.classList.toggle('on', a.dataset.t === t)); tabs[t](); };
  tabBar.onclick = (e) => { const a = e.target.closest('a'); if (a) { e.preventDefault(); go(a.dataset.t); } };
  go(mode);
}

function customFoodForm(f = {}) {
  return `<form id="cf" class="g2">
    <label class="fld span3"><span>Food name</span><input name="name" required dir="auto" value="${h(f.name || '')}"></label>
    <label class="fld"><span>Arabic name (optional)</span><input name="ar" dir="rtl" value="${h(f.ar || '')}"></label>
    <label class="fld"><span>Serving (e.g. 1 plate)</span><input name="serving" required value="${h(f.serving || '1 serving')}"></label>
    <label class="fld"><span>Serving weight <em>g</em></span><input name="g" type="number" step="any" value="${f.g ?? 100}"></label>
    <label class="fld"><span>Calories <em>kcal / serving</em></span><input name="kcal" type="number" step="any" required value="${f.kcal ?? ''}"></label>
    <label class="fld"><span>Protein <em>g</em></span><input name="p" type="number" step="any" value="${f.p ?? 0}"></label>
    <label class="fld"><span>Carbs <em>g</em></span><input name="c" type="number" step="any" value="${f.c ?? 0}"></label>
    <label class="fld"><span>Fat <em>g</em></span><input name="f" type="number" step="any" value="${f.f ?? 0}"></label>
    <label class="fld"><span>Type</span><select name="region"><option value="eg">Egyptian</option><option value="intl">International</option><option value="basic" selected>Basic</option></select></label>
    <div class="span3"><button class="btn">Save food</button></div></form>`;
}
function readCustom(form) {
  const v = Object.fromEntries(new FormData(form));
  return { id: 'c-' + uid(), name: v.name.trim(), ar: v.ar.trim(), region: v.region, cat: 'My foods', serving: v.serving, g: +v.g || 100,
    kcal: +v.kcal || 0, p: +v.p || 0, c: +v.c || 0, f: +v.f || 0, meals: 'blds' };
}

// ---------------- PLANS ----------------
function viewPlans() {
  const act = activePlan();
  app.innerHTML = `<div class="row between"><h2>My nutrition plans</h2><a class="btn" href="#/plan/new">+ New plan</a></div>
    <p class="muted small">Make as many plans as you like (e.g. "Cutting", "Ramadan", "Maintenance"). The active plan sets your daily targets.</p>
    ${db.plans.length ? `<div class="grid-cards">${db.plans.map((p) => `<div class="pcard plan ${act && act.id === p.id ? 'active' : ''}">
      <div class="pc-top"><b>${h(p.name)}</b>${act && act.id === p.id ? '<span class="pill good">Active</span>' : ''}<span class="pill">${h(SPLITS[p.split]?.[0] || '')}</span></div>
      <div class="big-kcal">${r0(p.kcal)} <small>kcal/day</small></div>
      <div class="small muted">Protein ${p.p} g · Carbs ${p.c} g · Fat ${p.f} g · ${p.mealsPerDay} meals · ${p.cuisine === 'eg' ? 'Egyptian' : p.cuisine === 'intl' ? 'International' : 'Mixed'} food</div>
      <div class="small muted">Goal: ${p.goalText || ''}</div>
      <div class="row gap wrap" style="margin-top:.6rem">
        ${act && act.id === p.id ? '' : `<button class="btn sm" data-act="${p.id}">Make active</button>`}
        <a class="btn sm ghost" href="#/plan/${p.id}">Open / edit</a>
        <button class="btn sm ghost" data-dup="${p.id}">Duplicate</button>
        <button class="btn sm danger ghost" data-del="${p.id}">Delete</button>
      </div></div>`).join('')}</div>` : `<div class="card center"><p>No plans yet.</p><a class="btn" href="#/plan/new">Create my first plan</a></div>`}`;
  app.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act) { db.activePlanId = b.dataset.act; save(); toast('Plan activated'); viewPlans(); }
    if (b.dataset.dup) {
      const p = db.plans.find((x) => x.id === b.dataset.dup);
      const c = JSON.parse(JSON.stringify(p)); c.id = uid(); c.name = p.name + ' (copy)'; c.createdAt = new Date().toISOString();
      db.plans.push(c); save(); viewPlans();
    }
    if (b.dataset.del) {
      const p = db.plans.find((x) => x.id === b.dataset.del);
      if (!(await confirmBox(`Delete the plan "${p.name}"? Your food log is kept.`))) return;
      db.plans = db.plans.filter((x) => x.id !== p.id);
      if (db.activePlanId === p.id) db.activePlanId = db.plans[0]?.id || null;
      save(); viewPlans();
    }
  };
}

function viewPlanEdit(id) {
  const isNew = id === 'new' || !db.plans.some((p) => p.id === id);
  const pr = { ...db.profile };
  const p = isNew ? { id: uid(), name: 'My plan', split: 'balanced', mealsPerDay: 4, cuisine: 'mixed', pP: 25, cP: 50, fP: 25, ...pr, profile: pr }
    : JSON.parse(JSON.stringify(db.plans.find((x) => x.id === id)));
  const prof = p.profile || pr;
  app.innerHTML = `<p><a href="#/plans">‹ All plans</a></p><h2>${isNew ? 'New nutrition plan' : 'Edit plan'}</h2>
  <form id="pf">
    <div class="card"><h3>1 · About you</h3><div class="g3">
      <label class="fld span3"><span>Plan name</span><input name="name" value="${h(p.name)}" required dir="auto"></label>
      <label class="fld"><span>Sex</span><select name="sex"><option value="female" ${prof.sex === 'female' ? 'selected' : ''}>Female</option><option value="male" ${prof.sex === 'male' ? 'selected' : ''}>Male</option></select></label>
      <label class="fld"><span>Age <em>years</em></span><input name="age" type="number" value="${prof.age}" required inputmode="numeric"></label>
      <label class="fld"><span>Height <em>cm</em></span><input name="height" type="number" step="any" value="${prof.height}" required inputmode="decimal"></label>
      <label class="fld"><span>Weight <em>kg</em></span><input name="weight" type="number" step="any" value="${prof.weight}" required inputmode="decimal"></label>
      <label class="fld span2"><span>Activity</span><select name="activity">${ACTIVITY.map(([v, l]) => `<option value="${v}" ${+prof.activity === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div></div>
    <div class="card"><h3>2 · Goal</h3><div class="g3">
      <label class="fld"><span>Goal</span><select name="goal">
        <option value="lose" ${prof.goal === 'lose' ? 'selected' : ''}>Lose weight</option><option value="maintain" ${prof.goal === 'maintain' ? 'selected' : ''}>Maintain</option><option value="gain" ${prof.goal === 'gain' ? 'selected' : ''}>Gain weight / muscle</option></select></label>
      <label class="fld"><span>Speed <em>kg per week</em></span><select name="rate">${[0.25, 0.5, 0.75, 1].map((v) => `<option value="${v}" ${+prof.rate === v ? 'selected' : ''}>${v} kg</option>`).join('')}</select></label>
      <label class="fld"><span>Override calories <em>optional</em></span><input name="override" type="number" value="${p.override || ''}" placeholder="auto" inputmode="numeric"></label>
    </div><div id="calcOut" class="calc"></div></div>
    <div class="card"><h3>3 · Macros & meals</h3><div class="g3">
      <label class="fld"><span>Diet style</span><select name="split">${Object.entries(SPLITS).map(([k, v]) => `<option value="${k}" ${p.split === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label>
      <label class="fld"><span>Protein <em>% kcal</em></span><input name="pP" type="number" value="${p.pP}"></label>
      <label class="fld"><span>Carbs <em>% kcal</em></span><input name="cP" type="number" value="${p.cP}"></label>
      <label class="fld"><span>Fat <em>% kcal</em></span><input name="fP" type="number" value="${p.fP}"></label>
      <label class="fld"><span>Meals per day</span><select name="mealsPerDay">${[3, 4, 5].map((n) => `<option value="${n}" ${+p.mealsPerDay === n ? 'selected' : ''}>${n === 3 ? '3 meals' : n === 4 ? '3 meals + 1 snack' : '3 meals + 2 snacks'}</option>`).join('')}</select></label>
      <label class="fld"><span>Food style</span><select name="cuisine">
        <option value="mixed" ${p.cuisine === 'mixed' ? 'selected' : ''}>Mixed (Egyptian + international)</option><option value="eg" ${p.cuisine === 'eg' ? 'selected' : ''}>Mostly Egyptian</option><option value="intl" ${p.cuisine === 'intl' ? 'selected' : ''}>Mostly international</option></select></label>
    </div><div id="macroOut" class="needs"></div></div>
    <div class="card"><div class="row between"><h3>4 · Daily menu</h3><button type="button" class="btn sm ghost" id="regen">↻ Generate new menu</button></div>
      <p class="small muted">A sample day that fits your plan. Regenerate for new ideas, remove items, or add your own.</p>
      <div id="menu"></div></div>
    <div class="savebar"><button class="btn">${isNew ? 'Save plan' : 'Save changes'}</button><label class="chk"><input type="checkbox" name="activate" ${isNew || db.activePlanId === p.id ? 'checked' : ''}> <span>Make this my active plan</span></label></div>
  </form>`;
  const form = $('#pf');
  const read = () => {
    const v = Object.fromEntries(new FormData(form));
    ['age', 'height', 'weight', 'activity', 'rate', 'pP', 'cP', 'fP', 'mealsPerDay'].forEach((k) => (v[k] = +v[k]));
    return v;
  };
  const recalc = () => {
    const v = read(); const t = calcTarget(v);
    const kcal = +v.override || t.kcal;
    const g = macroGrams(kcal, v.pP, v.cP, v.fP);
    const sum = v.pP + v.cP + v.fP;
    $('#calcOut').innerHTML = `<p>BMR (Mifflin-St Jeor): <b>${t.bmr}</b> kcal · Daily burn (TDEE): <b>${t.tdee}</b> kcal</p>
      <p>Your daily target: <b class="big-kcal-inline">${kcal} kcal</b> ${v.goal === 'lose' ? `(−${r0(v.rate * 1100)} kcal/day → about ${v.rate} kg/week)` : v.goal === 'gain' ? `(+${r0(v.rate * 1100)} kcal/day)` : ''}</p>
      ${t.warn && !v.override ? `<p class="bad-t small">${t.warn}</p>` : ''}`;
    $('#macroOut').innerHTML = `<div class="need"><span>Protein</span><b>${g.p} g</b><em>${r1(g.p / v.weight)} g/kg</em></div>
      <div class="need"><span>Carbs</span><b>${g.c} g</b></div><div class="need"><span>Fat</span><b>${g.f} g</b></div>
      ${sum !== 100 ? `<p class="bad-t small span3">Percentages add up to ${sum}%, they should add to 100%.</p>` : ''}`;
    Object.assign(p, { kcal, ...g, cuisine: v.cuisine, mealsPerDay: v.mealsPerDay });
    return v;
  };
  const drawMenu = () => {
    if (!p.mealPlan) p.mealPlan = generateMealPlan(p);
    const share = MEAL_SHARE[p.mealsPerDay] || MEAL_SHARE[4];
    const all = Object.values(p.mealPlan).flat(), t = totals(all);
    $('#menu').innerHTML = MEALS.filter(([k]) => share[k] > 0 || p.mealPlan[k]?.length).map(([k, label, ar]) => {
      const it = p.mealPlan[k] || [], mt = totals(it);
      return `<div class="menu-meal"><div class="row between"><b>${label} <span class="muted small" dir="rtl">${ar}</span></b><span class="small muted">${r0(mt.kcal)} / ~${r0(p.kcal * (share[k] || 0))} kcal</span></div>
        <ul class="entries">${it.map((e, i) => `<li><div class="en-main">${h(e.food.name)} <span class="muted small" dir="rtl">${h(e.food.ar || '')}</span><div class="small muted">${r1(e.qty)} × ${h(e.food.serving)}</div></div>
          <div class="en-qty"><span>${r0(e.food.kcal * e.qty)}</span></div><button type="button" class="x" data-rm="${k}:${i}" aria-label="Remove">×</button></li>`).join('')}</ul>
        <button type="button" class="btn ghost sm" data-madd="${k}">+ Add</button></div>`;
    }).join('') + `<p class="small"><b>Menu total: ${macroLine(t)}</b> <span class="muted">(target ${r0(p.kcal)} kcal)</span></p>`;
  };
  form.addEventListener('input', (e) => {
    if (e.target.name === 'split' && e.target.value !== 'custom') {
      const s = SPLITS[e.target.value]; form.pP.value = s[1]; form.cP.value = s[2]; form.fP.value = s[3];
    } else if (['pP', 'cP', 'fP'].includes(e.target.name)) form.split.value = 'custom';
    recalc();
    if (['cuisine', 'mealsPerDay', 'goal', 'rate', 'weight', 'height', 'age', 'sex', 'activity', 'override', 'split'].includes(e.target.name)) { p.mealPlan = null; drawMenu(); }
  });
  $('#regen').onclick = () => { p.mealPlan = generateMealPlan(p); drawMenu(); };
  $('#menu').onclick = (e) => {
    const rm = e.target.closest('[data-rm]');
    if (rm) { const [k, i] = rm.dataset.rm.split(':'); p.mealPlan[k].splice(+i, 1); drawMenu(); }
    const ad = e.target.closest('[data-madd]');
    if (ad) {
      const k = ad.dataset.madd;
      const S = sheet(`<h3>Add to ${k}</h3><div class="toolbar"><input id="mq" type="search" placeholder="Search foods" dir="auto"></div><ul class="flist" id="mres"></ul>`);
      const run = () => { $('#mres', S.el).innerHTML = searchFoods($('#mq', S.el).value).map((f) => foodRow(f)).join(''); };
      $('#mq', S.el).oninput = run; run();
      S.el.addEventListener('click', (ev) => {
        const pk = ev.target.closest('[data-pick]'); if (!pk) return;
        p.mealPlan[k] = p.mealPlan[k] || []; p.mealPlan[k].push({ food: snap(foodById(pk.dataset.pick)), qty: 1 });
        S.close(); drawMenu();
      });
    }
  };
  form.onsubmit = (e) => {
    e.preventDefault(); const v = recalc();
    if (v.pP + v.cP + v.fP !== 100) return toast('Macro percentages must add up to 100%');
    const goalText = v.goal === 'maintain' ? 'Maintain weight' : `${v.goal === 'lose' ? 'Lose' : 'Gain'} ${v.rate} kg/week`;
    const profile = { sex: v.sex, age: v.age, height: v.height, weight: v.weight, activity: v.activity, goal: v.goal, rate: v.rate };
    Object.assign(p, { name: v.name, split: v.split, pP: v.pP, cP: v.cP, fP: v.fP, override: +v.override || null, goalText, profile, updatedAt: new Date().toISOString() });
    if (isNew) { p.createdAt = new Date().toISOString(); db.plans.push(p); } else db.plans[db.plans.findIndex((x) => x.id === p.id)] = p;
    db.profile = profile;
    if (v.activate) db.activePlanId = p.id;
    save(); toast('Plan saved'); location.hash = '#/plans';
  };
  recalc(); drawMenu();
}

// ---------------- RECOMMENDATIONS ----------------
function viewRecommend() {
  const d = todayISO(), T = targetsFor(), t = dayTotals(d);
  const left = { kcal: T.kcal - t.kcal, p: T.p - t.p, c: T.c - t.c, f: T.f - t.f };
  const st = viewRecommend.st ||= { meal: guessMeal(), region: activePlan()?.cuisine || 'mixed' };
  const share = (MEAL_SHARE[T.mealsPerDay] || MEAL_SHARE[4])[st.meal] || 0.15;
  const L = db.log[d];
  const mealDone = L ? totals(L.meals[st.meal]).kcal : 0;
  // budget for this meal: its share of the day, but never more than what is left
  const budget = Math.max(0, Math.min(left.kcal, Math.max(T.kcal * share - mealDone, left.kcal > 0 ? Math.min(left.kcal, 150) : 0)));
  const tag = MEALS.find((m) => m[0] === st.meal)[3];
  const pool = allFoods().filter((f) => f.meals.includes(tag) && regionOK(f, st.region) && f.kcal > 0);
  const needP = left.p > 0 ? left.p / Math.max(left.kcal, 1) : 0; // g protein still needed per kcal left
  const score = (f) => {
    const fitK = budget > 0 ? Math.abs(f.kcal - budget * 0.8) / Math.max(budget, 100) : f.kcal / 100;
    const pd = f.p / f.kcal;
    const fatPen = left.f < 10 && f.f > 10 ? 0.5 : 0;
    return fitK - Math.min(pd, 0.15) * (needP > 0.06 ? 8 : 3) + fatPen;
  };
  const fits = pool.filter((f) => f.kcal <= Math.max(budget * 1.15, 120)).sort((a, b) => score(a) - score(b));
  const pick = (cats, n) => fits.filter((f) => cats(f)).slice(0, n);
  const egPicks = pick((f) => f.region === 'eg', 6), intlPicks = pick((f) => f.region === 'intl', 6);
  const highP = pool.filter((f) => f.kcal <= Math.max(budget, 250)).sort((a, b) => b.p / b.kcal - a.p / a.kcal).slice(0, 6);
  const light = allFoods().filter((f) => f.kcal > 0 && f.kcal <= 100 && f.meals.includes('s')).sort((a, b) => b.p / b.kcal - a.p / a.kcal).slice(0, 6);
  const favFit = db.favorites.map(foodById).filter((f) => f && f.kcal <= Math.max(budget * 1.15, 150)).slice(0, 6);
  // simple combo: main + side for the meal budget
  const combos = [];
  if (budget > 250) {
    const mains = fits.filter((f) => !MAIN_EXCLUDE.has(f.cat) && f.kcal < budget * 0.85).slice(0, 8);
    const sides = pool.filter((f) => SIDE_CATS.has(f.cat));
    for (const m of mains) {
      const rest = budget - m.kcal;
      const s = sides.filter((x) => x.kcal <= rest && x.id !== m.id).sort((a, b) => Math.abs(rest * 0.7 - a.kcal) - Math.abs(rest * 0.7 - b.kcal))[combos.length % 3];
      if (s) combos.push([m, s]);
      if (combos.length >= 4) break;
    }
  }
  const tips = [];
  if (left.kcal < 0) tips.push(`You are ${r0(-left.kcal)} kcal over today. Choose water, tea without sugar, salad or vegetables if you are still hungry, and a walk helps.`);
  if (left.p > 30 && left.kcal > 0) tips.push(`You still need ${r0(left.p)} g protein. Good Egyptian picks: gebna areesh, eggs, ful, grilled chicken or fish, termes, Greek yogurt.`);
  if (L && L.water < db.settings.waterGoal / 2 && new Date().getHours() > 14) tips.push(`Only ${L.water} glasses of water so far. Aim for ${db.settings.waterGoal}.`);
  if (left.f < 5 && left.kcal > 200) tips.push('Your fat budget is almost used. Prefer grilled or boiled foods over fried ones, and go easy on oil, tahini and ghee.');
  if (left.c < 0) tips.push('Carbs are over target. Swap bread or rice for extra vegetables or salad at the next meal.');
  if (!tips.length) tips.push('You are on track. Keep meals balanced: a protein, a vegetable or salad, and a carb portion that fits.');

  const card = (f) => `<div class="rcard"><div><b>${h(f.name)}</b>${f.ar ? `<div class="muted small" dir="rtl">${h(f.ar)}</div>` : ''}
      <div class="small muted">${h(f.serving)} · P ${r1(f.p)} · C ${r1(f.c)} · F ${r1(f.f)}</div></div>
      <div class="rc-r"><b>${r0(f.kcal)}</b><small>kcal</small><button class="btn sm" data-radd="${h(f.id)}">+ Add</button></div></div>`;
  const section = (title, list, sub = '') => list.length ? `<h3>${title}</h3>${sub ? `<p class="small muted">${sub}</p>` : ''}<div class="rgrid">${list.map(card).join('')}</div>` : '';

  app.innerHTML = `<h2>Meal recommendations</h2>
    <div class="card summary-sm">
      <div class="needs">
        <div class="need"><span>kcal left today</span><b class="${left.kcal < 0 ? 'bad-t' : ''}">${r0(left.kcal)}</b></div>
        <div class="need"><span>Protein left</span><b>${r0(Math.max(0, left.p))}</b><em>g</em></div>
        <div class="need"><span>Budget for ${st.meal}</span><b>${r0(budget)}</b><em>kcal</em></div>
      </div>
      <div class="chips">${MEALS.map(([k, l]) => `<button class="chip ${st.meal === k ? 'on' : ''}" data-meal="${k}">${l}</button>`).join('')}</div>
      <div class="chips">${[['mixed', 'All food'], ['eg', 'Egyptian'], ['intl', 'International']].map(([k, l]) => `<button class="chip ${st.region === k ? 'on' : ''}" data-reg="${k}">${l}</button>`).join('')}</div>
    </div>
    <div class="card"><h3>💡 Tips for you</h3><ul class="tips">${tips.map((x) => `<li>${h(x)}</li>`).join('')}</ul></div>
    ${combos.length ? `<h3>Complete ${st.meal} ideas</h3><div class="rgrid">${combos.map(([m, s]) => `<div class="rcard combo"><div><b>${h(m.name)}</b> + <b>${h(s.name)}</b>
       <div class="small muted">${h(m.serving)} + ${h(s.serving)} · P ${r1(m.p + s.p)} g</div></div>
       <div class="rc-r"><b>${r0(m.kcal + s.kcal)}</b><small>kcal</small><button class="btn sm" data-combo="${h(m.id)}|${h(s.id)}">+ Add both</button></div></div>`).join('')}</div>` : ''}
    ${st.region !== 'intl' ? section('🇪🇬 Egyptian picks that fit', egPicks) : ''}
    ${st.region !== 'eg' ? section('🌍 International picks that fit', intlPicks) : ''}
    ${section('💪 High-protein choices', highP, 'Most protein for the calories.')}
    ${section('★ Your favorites that fit', favFit)}
    ${section('🥗 Light snacks (≤ 100 kcal)', light, 'For when you are hungry but close to your target.')}`;
  app.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.meal) { st.meal = b.dataset.meal; return viewRecommend(); }
    if (b.dataset.reg) { st.region = b.dataset.reg; return viewRecommend(); }
    if (b.dataset.radd) { const f = foodById(b.dataset.radd); addEntry(d, st.meal, f, 1); toast(`Added ${f.name} to ${st.meal}`); return viewRecommend(); }
    if (b.dataset.combo) { b.dataset.combo.split('|').forEach((id) => addEntry(d, st.meal, foodById(id), 1)); toast(`Added to ${st.meal}`); return viewRecommend(); }
  };
}

// ---------------- HISTORY ----------------
function viewHistory() {
  const st = viewHistory.st ||= { days: 7 };
  const T = targetsFor();
  const days = Array.from({ length: st.days }, (_, i) => addDays(todayISO(), i - st.days + 1));
  const rows = days.map((d) => ({ d, t: dayTotals(d), logged: dayHasFood(d), w: db.log[d]?.weight, water: db.log[d]?.water || 0 }));
  const logged = rows.filter((r) => r.logged);
  const avg = (k) => logged.length ? logged.reduce((a, r) => a + r.t[k], 0) / logged.length : 0;
  let streak = 0; for (let d = todayISO(); dayHasFood(d); d = addDays(d, -1)) streak++;
  const onTarget = logged.filter((r) => Math.abs(r.t.kcal - T.kcal) <= T.kcal * 0.1).length;
  const max = Math.max(T.kcal * 1.3, ...rows.map((r) => r.t.kcal));
  const W = 640, H = 220, pad = 30, bw = (W - pad * 2) / rows.length;
  const y = (v) => H - pad - (v / max) * (H - pad * 2);
  const chart = `<svg viewBox="0 0 ${W} ${H}" class="hchart" role="img" aria-label="Calories per day">
    <line x1="${pad}" x2="${W - pad}" y1="${y(T.kcal)}" y2="${y(T.kcal)}" class="h-target"/>
    <text x="${W - pad}" y="${y(T.kcal) - 5}" class="h-lab" text-anchor="end">target ${r0(T.kcal)}</text>
    ${rows.map((r, i) => {
      const x = pad + i * bw + bw * 0.15, w = bw * 0.7, over = r.t.kcal > T.kcal * 1.1;
      return `<rect x="${x}" y="${y(r.t.kcal)}" width="${w}" height="${Math.max(0, H - pad - y(r.t.kcal))}" rx="3" class="h-bar ${over ? 'over' : ''}"><title>${niceDate(r.d)}: ${r0(r.t.kcal)} kcal</title></rect>
        ${rows.length <= 14 || i % 5 === 0 ? `<text x="${x + w / 2}" y="${H - 10}" class="h-lab" text-anchor="middle">${new Date(r.d + 'T12:00').toLocaleDateString(undefined, rows.length <= 7 ? { weekday: 'short' } : { day: 'numeric', month: 'numeric' })}</text>` : ''}`;
    }).join('')}</svg>`;
  const weights = Object.entries(db.log).filter(([, v]) => v.weight).sort(([a], [b]) => a.localeCompare(b));
  app.innerHTML = `<h2>History & progress</h2>
    <div class="chips">${[7, 14, 30].map((n) => `<button class="chip ${st.days === n ? 'on' : ''}" data-days="${n}">${n} days</button>`).join('')}</div>
    <div class="needs four">
      <div class="need"><span>Avg kcal</span><b>${r0(avg('kcal'))}</b><em>target ${r0(T.kcal)}</em></div>
      <div class="need"><span>Avg protein</span><b>${r0(avg('p'))}</b><em>g (target ${T.p})</em></div>
      <div class="need"><span>Days on target</span><b>${onTarget}/${logged.length}</b><em>within ±10%</em></div>
      <div class="need"><span>Streak</span><b>${streak}</b><em>day${streak === 1 ? '' : 's'} logged</em></div>
    </div>
    <div class="card">${chart}</div>
    <div class="card"><h3>Daily log</h3><div class="tablewrap"><table class="tbl"><thead><tr><th>Day</th><th>kcal</th><th>P</th><th>C</th><th>F</th><th>Water</th><th>Weight</th></tr></thead>
      <tbody>${rows.slice().reverse().map((r) => `<tr><td><a href="#/today" data-go="${r.d}">${niceDate(r.d)}</a></td><td>${r.logged ? r0(r.t.kcal) : '—'}</td><td>${r.logged ? r0(r.t.p) : ''}</td><td>${r.logged ? r0(r.t.c) : ''}</td><td>${r.logged ? r0(r.t.f) : ''}</td><td>${r.water || ''}</td><td>${r.w ?? ''}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card"><h3>Weight</h3>${weights.length ? `<p>Start: <b>${weights[0][1].weight} kg</b> (${niceDate(weights[0][0])}) · Latest: <b>${weights.at(-1)[1].weight} kg</b> (${niceDate(weights.at(-1)[0])}) ·
      Change: <b>${r1(weights.at(-1)[1].weight - weights[0][1].weight)} kg</b></p>${weightChart(weights)}` : '<p class="muted small">Log your weight on the Today page to see your progress here.</p>'}</div>`;
  app.onclick = (e) => {
    const b = e.target.closest('[data-days]'); if (b) { st.days = +b.dataset.days; viewHistory(); }
    const g = e.target.closest('[data-go]'); if (g) state.date = g.dataset.go;
  };
}
function weightChart(ws) {
  if (ws.length < 2) return '';
  const W = 640, H = 180, pad = 34, vals = ws.map(([, v]) => v.weight), lo = Math.min(...vals) - 1, hi = Math.max(...vals) + 1;
  const t0 = new Date(ws[0][0]).getTime(), t1 = new Date(ws.at(-1)[0]).getTime() || t0 + 1;
  const x = (d) => pad + ((new Date(d).getTime() - t0) / Math.max(t1 - t0, 1)) * (W - pad * 2);
  const y = (v) => H - pad - ((v - lo) / (hi - lo)) * (H - pad * 2);
  const pts = ws.map(([d, v]) => `${x(d)},${y(v.weight)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" class="hchart"><text x="4" y="${y(hi - 1) + 4}" class="h-lab">${r1(hi - 1)}</text><text x="4" y="${y(lo + 1) + 4}" class="h-lab">${r1(lo + 1)}</text>
    <polyline points="${pts}" class="w-line"/>${ws.map(([d, v]) => `<circle cx="${x(d)}" cy="${y(v.weight)}" r="4" class="w-pt"><title>${niceDate(d)}: ${v.weight} kg</title></circle>`).join('')}</svg>`;
}

// ---------------- FOODS ----------------
function viewFoods() {
  const st = viewFoods.st ||= { q: '', region: 'all' };
  app.innerHTML = `<h2>Food database</h2><p class="muted small">${FOODS.length} built-in Egyptian & international foods, plus ${db.customFoods.length} of your own. Search in English or Arabic.</p>
    <details class="card"><summary><h3>+ Add my own food</h3></summary>${customFoodForm()}</details>
    <div class="toolbar"><input id="fq" type="search" placeholder="Search foods…" value="${h(st.q)}" dir="auto">
      <select id="fr">${[['all', 'All'], ['eg', 'Egyptian'], ['intl', 'International'], ['basic', 'Basic'], ['custom', 'My foods']].map(([v, l]) => `<option value="${v}" ${st.region === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <ul class="flist" id="fl"></ul>`;
  const run = () => {
    st.q = $('#fq').value; st.region = $('#fr').value;
    $('#fl').innerHTML = searchFoods(st.q, st.region, 400).map((f) => foodRow(f, f.id.startsWith('c-') || f.id.startsWith('bc-') ? ` <button class="linkbtn" data-delfood="${h(f.id)}">delete</button>` : '')).join('');
  };
  $('#fq').oninput = run; $('#fr').onchange = run; run();
  $('#cf').onsubmit = (e) => { e.preventDefault(); db.customFoods.unshift(readCustom(e.target)); save(); e.target.reset(); toast('Food saved'); run(); };
  app.onclick = async (e) => {
    const del = e.target.closest('[data-delfood]');
    if (del) { if (await confirmBox('Delete this food from My foods?')) { db.customFoods = db.customFoods.filter((f) => f.id !== del.dataset.delfood); save(); run(); } return; }
    const p = e.target.closest('[data-pick]'); if (p) { state.date = todayISO(); openAddWith(foodById(p.dataset.pick)); }
  };
}
function openAddWith(f) {
  // quick add from the Foods page: choose the meal, then quantity
  const S = sheet(`<h3>Add ${h(f.name)}</h3><p class="small muted">${h(f.serving)} · ${r0(f.kcal)} kcal</p>
    <div class="g2"><label class="fld"><span>Meal</span><select id="om">${MEALS.map(([k, l]) => `<option value="${k}" ${k === guessMeal() ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="fld"><span>Servings</span><input id="oq" type="number" value="1" step="0.25" inputmode="decimal"></label></div>
    <button class="btn" id="ook">Add to today</button>`);
  $('#ook', S.el).onclick = () => { addEntry(todayISO(), $('#om', S.el).value, f, +$('#oq', S.el).value || 1); toast('Added to today'); S.close(); };
}

// ---------------- SETTINGS ----------------
function viewSettings() {
  const s = db.settings;
  app.innerHTML = `<h2>Settings</h2>
  <div class="card"><h3>📷 AI meal scanner</h3>
    <p class="small muted">The photo scanner uses Claude (by Anthropic) to recognise foods and estimate calories. Paste your own API key from
    <b>console.anthropic.com → API keys</b>. The key is stored only on this device and is sent only to Anthropic. Each scan costs a few cents or less on your Anthropic account.</p>
    <label class="fld"><span>Anthropic API key</span><input id="key" type="password" autocomplete="off" placeholder="sk-ant-…" value="${h(s.apiKey)}"></label>
    <div class="row gap"><button class="btn sm" id="saveKey">Save key</button>${s.apiKey ? '<button class="btn sm danger ghost" id="delKey">Remove key</button>' : ''}</div>
    <p class="small muted">The barcode scanner and food search work without a key.</p></div>
  <div class="card"><h3>💧 Water goal</h3><label class="fld"><span>Glasses per day</span><input id="wg" type="number" min="1" max="20" value="${s.waterGoal}"></label></div>
  <div class="card"><h3>💾 Backup</h3>
    <p class="small muted">Your plans, log and foods are saved in this browser. Download a backup to keep them safe or move them to another phone or computer.</p>
    <div class="row gap wrap"><button class="btn sm" id="exp">Download backup</button>
    <label class="btn sm ghost">Restore backup<input type="file" id="imp" accept="application/json,.json" hidden></label></div></div>
  <div class="card"><h3>Danger zone</h3><button class="btn sm danger ghost" id="wipe">Delete all my nutrition data</button></div>
  <p class="small muted">Calorie targets use the Mifflin-St Jeor equation. Food values are typical portions and are estimates. This app supports, and does not replace, advice from a dietitian or doctor.</p>`;
  $('#saveKey').onclick = () => { s.apiKey = $('#key').value.trim(); save(); toast(s.apiKey ? 'Key saved' : 'Key cleared'); viewSettings(); };
  $('#delKey') && ($('#delKey').onclick = () => { s.apiKey = ''; save(); viewSettings(); });
  $('#wg').onchange = (e) => { s.waterGoal = Math.max(1, +e.target.value || 8); save(); toast('Saved'); };
  $('#exp').onclick = () => {
    const blob = new Blob([JSON.stringify({ ...db, settings: { ...db.settings, apiKey: '' } }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `nutrition-backup-${todayISO()}.json`; a.click();
  };
  $('#imp').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data.plans || !data.log) throw new Error('not a backup');
      if (!(await confirmBox('Replace the data on this device with the backup?', 'Restore'))) return;
      const key = db.settings.apiKey; db = Object.assign(blank(), data); db.settings = Object.assign(blank().settings, data.settings, { apiKey: key });
      save(); toast('Backup restored'); viewSettings();
    } catch { alert('This file is not a valid nutrition backup.'); }
  };
  $('#wipe').onclick = async () => {
    if (!(await confirmBox('Delete ALL plans, food logs and custom foods on this device? This cannot be undone.'))) return;
    db = blank(); save(); toast('All data deleted'); location.hash = '#/today';
  };
}

// ---------------- start ----------------
window.__ntStarted = true;
route();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => {});
