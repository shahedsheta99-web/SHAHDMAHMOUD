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
//  IV products are intentionally ignored for now.
//
//  Electrolyte values below were scaled per 100 kcal from the manufacturer's
//  data sheets to the kcal per serving in your PDF. Formulations differ between
//  countries, so CHECK THEM AGAINST THE LABEL OF THE PRODUCT YOU USE.
//   Peptamen Junior: Nestlé UK data card, powder at 1 kcal/mL (2023): Na 68, K 134, P 62 mg/100 kcal
//   Peptamen:        Nestlé Singapore powder (per 100 g = 466 kcal): Na 400, K 520, P 310 mg
//   Supportan:       Fresenius Kabi data card, per 100 mL (150 kcal): Na 47.5, K 128, P 120 mg
// =====================================================================
export const DEFAULT_FORMULAS = [
  { id: 'pediasure',   name: 'Pediasure',     minAge: 1,  maxAge: 10, scoops: 5,    volume: 200,  kcal: 225, protein: 6.7,  type: 'complete', note: '' },
  { id: 'gf',          name: 'G.F',           minAge: 1,  maxAge: 12, scoops: 2,    volume: 100,  kcal: 118, protein: 6.2,  type: 'complete', note: '' },
  { id: 'ensure',      name: 'Ensure',        minAge: 10, maxAge: 99, scoops: 6,    volume: 230,  kcal: 230, protein: 8.5,  type: 'complete', note: '' },
  { id: 'bioganers',   name: 'Bioganers',     minAge: 3,  maxAge: 99, scoops: 2,    volume: 100,  kcal: 120, protein: 7,    type: 'complete', note: '' },
  { id: 'blendra',     name: 'Blendra',       minAge: 3,  maxAge: 99, scoops: 6,    volume: 160,  kcal: 225, protein: 8.4,  type: 'complete', note: '' },
  { id: 'forticare',   name: 'Forticare',     minAge: 3,  maxAge: 99, scoops: null, volume: null, kcal: 203, protein: 11,   type: 'complete', note: '' },
  { id: 'fortisip',    name: 'Fortisip',      minAge: 3,  maxAge: 99, scoops: null, volume: null, kcal: 203, protein: 11,   type: 'complete', note: '' },
  { id: 'supportan',   name: 'Supportan',     minAge: 3,  maxAge: 99, scoops: null, volume: 200,  kcal: 300, protein: 20,   type: 'complete', note: '',
    na: 95, k: 256, p: 240, source: 'Fresenius Kabi Supportan Drink data card (per 100 mL ×2)' },
  { id: 'ferrusbin',   name: 'Ferrusbin',     minAge: 3,  maxAge: 99, scoops: null, volume: null, kcal: 400, protein: 20,   type: 'complete', note: '' },
  { id: 'neomune',     name: 'Neomune',       minAge: 3,  maxAge: 99, scoops: 7,    volume: 250,  kcal: 254, protein: 15.6, type: 'complete', note: '' },
  { id: 'aminoliban',  name: 'Aminoliban',    minAge: 3,  maxAge: 99, scoops: 5,    volume: 200,  kcal: 210, protein: 13.5, type: 'complete', note: '' },
  { id: 'peptaminjr',  name: 'Peptamen Jr.',  minAge: 1,  maxAge: 10, scoops: 7,    volume: 210,  kcal: 250, protein: 7,    type: 'complete', note: '',
    na: 170, k: 335, p: 155, source: 'Nestlé UK Peptamen Junior powder data card 2023 (scaled per 100 kcal)' },
  { id: 'peptaminace', name: 'Peptamen ACE',  minAge: 10, maxAge: 13, scoops: 6,    volume: 210,  kcal: 242, protein: 9,    type: 'complete', note: '' },
  { id: 'peptamin',    name: 'Peptamen',      minAge: 13, maxAge: 99, scoops: 6,    volume: 210,  kcal: 250, protein: 10,   type: 'complete', note: '',
    na: 215, k: 279, p: 166, source: 'Nestlé Singapore Peptamen powder (scaled per 100 kcal)' },
  { id: 'ferrusbinpd', name: 'Ferrusbin pd.', minAge: 1,  maxAge: 99, scoops: 2,    volume: 100,  kcal: 54,  protein: 13.2, type: 'module',   note: 'Protein powder – use as add-on' },
];

// Electrolytes tracked: key, label, lab key, mg per mmol
export const ELECTROLYTES = [
  ['na', 'Na', 'na', 23.0], ['k', 'K', 'k', 39.1], ['ca', 'Ca', 'tca', 40.08], ['p', 'P', 'po4', 30.97], ['mg', 'Mg', 'mg', 24.31],
];

// The active list: the user's edited list (saved in their account) or the default.
let custom = null;
export function setCustomFormulas(list) { custom = Array.isArray(list) && list.length ? list : null; }
export const formulas = () => custom || DEFAULT_FORMULAS;
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
