// =====================================================================
//  formulas.js — Oral nutrition supplements (ONS) from "Nutrition.pdf".
//
//  You can now edit, add and remove products INSIDE THE APP (Formulas page).
//  This file only holds the starting list.
//    minAge / maxAge are in YEARS (maxAge: 99 = no upper limit)
//    scoops / volume = per serving (null when the PDF shows "-----")
//    kcal / protein  = per serving
//    na, k, ca, p, mg = mg PER SERVING (null = not known yet → add from the label)
//    type: 'complete' = can be the main formula, 'module' = add-on (e.g. protein powder)
//    source: where the electrolyte values came from
//  IV products (amino acids, Dipeptiven) are in js/tpn.js.
//
//  Electrolyte values (mg per serving) come from the label comparison tables you sent
//  ("Nutritional Formula Comparison", "ONS Comparison Table", Nov 2026). Where the label
//  reference amount differs from your serving (e.g. "per 100 g powder"), values were
//  scaled by energy: label value × (serving kcal ÷ label kcal).
// =====================================================================
const SRC1 = 'Nutritional Formula Comparison (label)';
const SRC2 = 'ONS Comparison Table (label)';
export const DEFAULT_FORMULAS = [
  { id: 'pediasure',   name: 'Pediasure',          minAge: 1,  maxAge: 10, scoops: 5,    volume: 200,  kcal: 225,   protein: 6.7,  type: 'complete', note: '' },
  { id: 'gf',          name: 'G.F',                minAge: 1,  maxAge: 12, scoops: 2,    volume: 100,  kcal: 118,   protein: 6.2,  type: 'complete', note: '' },
  { id: 'ensure',      name: 'Ensure',             minAge: 10, maxAge: 99, scoops: 6,    volume: 230,  kcal: 230,   protein: 8.5,  type: 'complete',
    na: 154, k: 304, ca: 115, p: 108, mg: 31.1, note: 'General supplement, lactose-free', source: SRC1 + ', per 100 g scaled' },
  { id: 'bioganers',   name: 'Bio Gainers S10',    minAge: 3,  maxAge: 99, scoops: 2,    volume: 100,  kcal: 120,   protein: 7,    type: 'complete',
    na: 254, k: 454, ca: 296, p: 252, mg: 35.6, note: 'High-calorie supplement', source: SRC1 + ', scaled; Ca read as mg (label says mcg)' },
  { id: 'blendra',     name: 'Plendra (Blendra)',  minAge: 3,  maxAge: 99, scoops: 6,    volume: 160,  kcal: 225,   protein: 8.4,  type: 'complete',
    na: 178, k: 247, ca: 121, p: 127, mg: 56, note: 'General malnutrition / diabetes support, FOS', source: SRC1 + ', per 50 g' },
  { id: 'oncepro',     name: 'Once PRO',           minAge: 3,  maxAge: 99, scoops: null, volume: null, kcal: 204,   protein: 9.96, type: 'complete',
    na: 199, k: 332, ca: 133, p: 136, mg: 44.2, note: 'Low GI / diabetes. Serving 40 g powder. Age group not on label: check', source: SRC1 + ', per 40 g' },
  { id: 'forticare',   name: 'FortiCare',          minAge: 3,  maxAge: 99, scoops: null, volume: 125,  kcal: 203.7, protein: 11,   type: 'complete',
    na: 137.5, k: 268.75, ca: 212.5, p: 150, mg: 35, note: 'Oncology, EPA-enriched, 1.63 kcal/mL. Not < 3 y', source: SRC2 + ', per 125 mL' },
  { id: 'fortisip',    name: 'Fortisip',           minAge: 3,  maxAge: 99, scoops: null, volume: 200,  kcal: 245,   protein: 14.6, type: 'complete',
    na: 35, k: 97.6, ca: 350, p: 282, mg: 54, note: 'Disease-related malnutrition. Caution 3–6 y', source: SRC2 + ', per 200 mL' },
  { id: 'fresubin',    name: 'Fresubin Original DRINK', minAge: 3, maxAge: 99, scoops: null, volume: 200, kcal: 200, protein: 7.6, type: 'complete',
    na: 150, k: 250, ca: 120, p: 94, mg: 40, note: '1 kcal/mL, fibre-free. Not < 3 y, caution < 6 y', source: SRC2 + ', per 200 mL' },
  { id: 'supportan',   name: 'Supportan DRINK',    minAge: 3,  maxAge: 99, scoops: null, volume: 200,  kcal: 300,   protein: 20,   type: 'complete',
    na: 95, k: 256, ca: 406, p: 240, mg: 52, note: 'Cancer / cachexia, EPA+DHA, MCT. Not < 3 y', source: SRC2 + ', per 200 mL' },
  { id: 'ferrusbin',   name: 'Ferrusbin',          minAge: 3,  maxAge: 99, scoops: null, volume: null, kcal: 400,   protein: 20,   type: 'complete', note: '' },
  { id: 'neomune',     name: 'Neo-Mune',           minAge: 3,  maxAge: 99, scoops: 7,    volume: 250,  kcal: 254,   protein: 15.6, type: 'complete',
    na: 199.5, k: 252, ca: 149.5, p: 57, mg: 71.3, note: 'Immunonutrition: arginine, glutamine, fish oil, MCT', source: SRC1 + ', per 60 g' },
  { id: 'aminoliban',  name: 'Aminoleban Oral',    minAge: 3,  maxAge: 99, scoops: 5,    volume: 200,  kcal: 210,   protein: 13.5, type: 'complete',
    na: 47.5, k: 162, ca: 69, p: 83.8, mg: 20.2, note: 'Liver disease / hepatic encephalopathy: high BCAA, low AAA', source: SRC1 + ', per 50 g' },
  { id: 'peptaminjr',  name: 'Peptamen Jr.',       minAge: 1,  maxAge: 10, scoops: 7,    volume: 210,  kcal: 250,   protein: 7,    type: 'complete',
    na: 170, k: 335, p: 155, note: '', source: 'Nestlé UK Peptamen Junior powder data card 2023 (scaled per 100 kcal)' },
  { id: 'peptaminace', name: 'Peptamen ACE',       minAge: 10, maxAge: 13, scoops: 6,    volume: 210,  kcal: 242,   protein: 9,    type: 'complete', note: '' },
  { id: 'peptamin',    name: 'Peptamen',           minAge: 13, maxAge: 99, scoops: 6,    volume: 210,  kcal: 250,   protein: 10,   type: 'complete',
    na: 217, k: 285, ca: 255, p: 178, mg: 62.5, note: 'Peptide-based, MCT: malabsorption / critical illness', source: SRC1 + ', per 100 g scaled' },
  { id: 'ferrusbinpd', name: 'Ferrusbin pd.',      minAge: 1,  maxAge: 99, scoops: 2,    volume: 100,  kcal: 54,    protein: 13.2, type: 'module',   note: 'Protein powder – use as add-on' },
];

// Electrolytes tracked: key, label, lab key, mg per mmol
export const ELECTROLYTES = [
  ['na', 'Na', 'na', 23.0], ['k', 'K', 'k', 39.1], ['ca', 'Ca', 'tca', 40.08], ['p', 'P', 'po4', 30.97], ['mg', 'Mg', 'mg', 24.31],
];

// The active list: the user's edited list (saved in their account) or the default.
// A saved list is merged with the defaults: your own values are kept, empty
// fields are filled from the defaults, and new default products are added.
// Deleted default products are kept with hidden: true so they do not come back.
let custom = null;
const FILL = ['na', 'k', 'ca', 'p', 'mg', 'note', 'source'];
const empty = (v) => v === null || v === undefined || v === '';
export function setCustomFormulas(list) {
  if (!Array.isArray(list) || !list.length) { custom = null; return; }
  const merged = list.map((it) => {
    const d = DEFAULT_FORMULAS.find((x) => x.id === it.id);
    if (!d) return it;
    const out = { ...it };
    FILL.forEach((k) => { if (empty(out[k]) && !empty(d[k])) out[k] = d[k]; });
    return out;
  });
  DEFAULT_FORMULAS.forEach((d) => { if (!merged.some((x) => x.id === d.id)) merged.push({ ...d }); });
  custom = merged;
}
export const allFormulas = () => custom || DEFAULT_FORMULAS;
export const FORMULA_DATA_DATE = '28 Nov 2026';
// Replace every default product with the latest data (keeps your own added products
// and keeps deleted products hidden).
export function latestDataList() {
  const list = (custom || DEFAULT_FORMULAS).map((it) => {
    const d = DEFAULT_FORMULAS.find((x) => x.id === it.id);
    return d ? { ...d, ...(it.hidden ? { hidden: true } : {}) } : it;
  });
  DEFAULT_FORMULAS.forEach((d) => { if (!list.some((x) => x.id === d.id)) list.push({ ...d }); });
  return list;
}
// Default products whose saved values differ from the latest data
export function outdatedProducts() {
  if (!custom) return [];
  const keys = ['name', 'kcal', 'protein', 'scoops', 'volume', 'minAge', 'maxAge', 'na', 'k', 'ca', 'p', 'mg'];
  return custom.filter((it) => !it.hidden).filter((it) => {
    const d = DEFAULT_FORMULAS.find((x) => x.id === it.id);
    return d && keys.some((k) => String(it[k] ?? '') !== String(d[k] ?? ''));
  }).map((it) => it.name);
}
export const formulas = () => allFormulas().filter((f) => !f.hidden);
export const isCustomized = () => !!custom;

export const ageLabel = (f) => (f.maxAge >= 99 ? `> ${f.minAge} y` : `${f.minAge}–${f.maxAge} y`);
export const formulaById = (id) => formulas().find((f) => f.id === id);
export const fitsAge = (f, ageY) => ageY != null && ageY >= f.minAge && ageY <= f.maxAge;
const has = (v) => v !== null && v !== undefined && v !== '' && !isNaN(+v);

// How much of a product supplies the energy target, and what that gives.
export function evaluateFormula(f, kcalTarget, proteinTarget, pMin, pMax) {
  if (!kcalTarget) return null;
  const servings = kcalTarget / f.kcal;
  const protein = servings * f.protein;
  const lytes = {};
  ELECTROLYTES.forEach(([k]) => { lytes[k] = has(f[k]) ? servings * f[k] : null; });
  let pStatus = null;
  if (pMin != null && pMax != null) pStatus = protein < pMin ? 'below' : protein > pMax ? 'above' : 'within';
  return {
    servings, protein, lytes, pStatus,
    scoops: f.scoops ? servings * f.scoops : null,
    volume: f.volume ? servings * f.volume : null,
    proteinPct: proteinTarget ? (protein / proteinTarget) * 100 : null,
  };
}

// Rank age-appropriate complete formulas.
//  1) protein inside the patient's min–max range comes first (closest to target next)
//  2) when a lab electrolyte is HIGH, products with less of it rank higher;
//     when it is LOW, products with more of it rank higher. Unknown values rank last.
export function recommendFormulas(ageY, kcalTarget, proteinTarget, pMin, pMax, labStatus = {}) {
  const list = formulas().filter((f) => f.type === 'complete' && fitsAge(f, ageY))
    .map((f) => ({ f, ev: evaluateFormula(f, kcalTarget, proteinTarget, pMin, pMax) }))
    .filter((x) => x.ev);
  const abnormal = ELECTROLYTES.filter(([k]) => labStatus[k]);
  // electrolyte score: rank position among products that have data (0 = best)
  abnormal.forEach(([k]) => {
    const dir = labStatus[k] === 'high' ? 1 : -1;
    const known = list.filter((x) => x.ev.lytes[k] != null).sort((a, b) => dir * (a.ev.lytes[k] - b.ev.lytes[k]));
    list.forEach((x) => { x.lyteScore = (x.lyteScore || 0) + (x.ev.lytes[k] == null ? list.length : known.indexOf(x)); });
  });
  const pPen = (x) => (x.ev.pStatus === 'within' ? 0 : x.ev.pStatus == null ? 0 : 1);
  return list.sort((a, b) => pPen(a) - pPen(b)
    || (a.lyteScore || 0) - (b.lyteScore || 0)
    || Math.abs((a.ev.proteinPct ?? 100) - 100) - Math.abs((b.ev.proteinPct ?? 100) - 100));
}

// Totals for a regimen made of several products [{id, servings}]
export function regimenTotals(items = []) {
  const t = { kcal: 0, protein: 0, volume: 0, scoops: 0, lytes: {}, missing: [], missingBy: {} };
  ELECTROLYTES.forEach(([k]) => { t.lytes[k] = 0; t.missingBy[k] = []; });
  items.forEach((it) => {
    const f = formulaById(it.id); const s = +it.servings || 0;
    if (!f || !s) return;
    t.kcal += f.kcal * s; t.protein += f.protein * s;
    if (f.volume) t.volume += f.volume * s;
    if (f.scoops) t.scoops += f.scoops * s;
    ELECTROLYTES.forEach(([k]) => { if (has(f[k])) t.lytes[k] += f[k] * s; else t.missingBy[k].push(f.name); });
    if (ELECTROLYTES.some(([k]) => !has(f[k]))) t.missing.push(f.name);
  });
  return t;
}
